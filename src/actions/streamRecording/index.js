const fs = require('fs')
const moment = require('moment-timezone')
const os = require('os')
const pLimit = require('p-limit')
const request = require('superagent')

require('dotenv').config()

const { SERVE_FOLDER } = process.env

const {
  getAllActivatedRadios,
  insertRadioStreamsRecords,
  insertRadioStreamsInBQ
} = require('../../models')

const { uploadFile } = require('../../interfaces')

moment.locale('fr')

function recordStream({ radio, day, timestamp, fileDate, deadline }) {
  const { name, stream_url, stream_content_type } = radio
  return new Promise((resolve) => {
    const ext = stream_content_type.includes('audio/aac') ? 'aac' : 'mp3'
    const recordFile = `${name}@${fileDate}.${ext}`

    const lastHourType =
      moment(timestamp).hour() % 2 === 1 ? 'lastOddHour' : 'lastEvenHour'
    const tmpRecordsFolder = SERVE_FOLDER
    if (!fs.existsSync(tmpRecordsFolder)) {
      fs.mkdirSync(tmpRecordsFolder)
    }
    const tmpStreamPath = `${tmpRecordsFolder}/${name}@${lastHourType}.${ext}`
    const stream = fs.createWriteStream(tmpStreamPath)

    let error = null
    let success = false

    stream.on('close', () => {
      resolve({
        radio,
        recordFile,
        day,
        timestamp,
        fileDate,
        tmpStreamPath,
        success,
        error
      })
    })

    stream.on('error', (e) => {
      error = e
      console.error(`Stream errored`, {
        e,
        recordFile,
        stream_url
      })
      stream.close()
    })

    // console.log("Ready to record stream", { name, url });
    request
      .get(stream_url)
      .timeout({
        deadline
      })
      .on('end', (end) => {
        stream.close()
        if (!success) console.error(`End request for ${recordFile}`)
      })
      .on('error', (e) => {
        success = e.timeout

        if (!success) {
          error = e
          console.error(`Error on request: ${e}`, { name, stream_url })
        }

        stream.close()
      })
      .pipe(stream)
  })
}

async function saveRecord(
  {
    radio,
    recordFile,
    day,
    timestamp,
    fileDate,
    tmpStreamPath,
    success,
    error
  },
  saveToDb = true
) {
  const streamRecords = []
  const {
    origin,
    img,
    stream_url,
    radio_category,
    id,
    name,
    active,
    stream_content_type
  } = radio
  let recordUrl, recordPath

  if (success) {
    try {
      const { record_url, record_path } = await uploadFile(
        'record',
        tmpStreamPath,
        `${name}/${day}/`,
        recordFile
      )

      recordUrl = record_url
      recordPath = record_path

      streamRecords.push({
        radio_id: id,
        timestamp,
        record_url,
        record_path
      })
    } catch (e) {
      error = e
      console.error(`Error during upload for file ${recordFile}`, e)
    }
  }
  /*
  else {
    console.log(`No success for ${name} record`, error)
  }
  */

  if (streamRecords.length && saveToDb) {
    await insertRadioStreamsRecords(streamRecords)

    const row = {
      origin,
      record_url: recordUrl,
      img,
      stream_url,
      radio_category,
      id: new Date().valueOf(),
      timestamp,
      name,
      record_path: recordPath,
      active: Boolean(active),
      content_type: stream_content_type,
      radio_id: id
    }

    try {
      await insertRadioStreamsInBQ([row])
    } catch (e) {
      console.error('Cannot insert in BQ', row, e)
    }
  }

  // console.log('end saveRec', streamRecords.length && saveToDb, streamRecords)

  return {
    radio,
    recordFile,
    timestamp,
    tmpStreamPath,
    error
  }
}

module.exports = async (
  deadline = 60000 * 60,
  saveToDb = true,
  inputRadios
) => {
  // load during one hour by default

  console.log(`${new Date().toJSON()} Stream record unit process start`)

  const now = moment().tz('Europe/Paris')
  const day = now.format('YY-MM-DD')
  const timestamp = now.format('YYYY-MM-DD HH:00:00') // now.format()
  const fileDate = now.format('ddd YY-MM-DD HH')

  const radios = inputRadios || (await getAllActivatedRadios())

  const allRecordsResults = await Promise.all(
    radios.map((radio) =>
      recordStream({ radio, day, timestamp, fileDate, deadline })
    )
  )

  const limit = pLimit(3)
  const savePromises = allRecordsResults.map((recordResult) =>
    limit(() =>
      saveRecord(recordResult, saveToDb).catch((e) =>
        console.error(`Error uploading ${recordResult} : ${e}`)
      )
    )
  )
  try {
    await Promise.all(savePromises)
  } catch (e) {
    console.error(`streamRecording::save:: Error uploading all results`)
  }

  for (let { tmpStreamPath } of allRecordsResults) {
    try {
      // fs.unlinkSync(tmpStreamPath)
    } catch (e) {
      console.error('Error unlinking ', tmpStreamPath, e)
    }
  }

  console.log(`${new Date().toJSON()} Stream  record unit process done`)
}
