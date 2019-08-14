const fs = require('fs')
const moment = require('moment-timezone')
const os = require('os')
const request = require('superagent')

const {
  getAllActivatedRadios
  // insertRadioStreamsRecords
} = require('../../models')

const { uploadFile } = require('../../interfaces')

moment.locale('fr')

function recordStream ({ radio, day, timestamp, fileDate, deadline }) {
  const { name, stream_url } = radio
  return new Promise(resolve => {
    const recordName = `${name}@${fileDate}`
    const recordFile = `${recordName}.mp3`
    const tmpStreamPath = `${os.tmpdir()}/${recordFile}`
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

    stream.on('error', e => {
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
      .on('end', end => {
        stream.close()
        if (!success) console.error(`End request for ${recordFile}`)
      })
      .on('error', e => {
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

async function saveRecord ({
  radio,
  recordFile,
  day,
  timestamp,
  fileDate,
  tmpStreamPath,
  success,
  error
}) {
  let recordUrl, mysqlId

  const streamRecords = []
  const { id, name } = radio
  if (success) {
    try {
      const { record_url, record_path } = await uploadFile(
        'record',
        tmpStreamPath,
        `${name}/${day}/`
      )

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

  if (streamRecords.length) {
    // await insertRadioStreamsRecords(streamRecords)
  }

  return {
    radio,
    recordFile,
    timestamp,
    tmpStreamPath,
    recordUrl,
    mysqlId,
    error
  }
}

module.exports = async (deadline = 60000 * 60) => {
  // load during one hour by default

  console.log(`${new Date().toJSON()} Stream record unit process start`)

  const now = moment().tz('Europe/Paris')
  const day = now.format('YY-MM-DD')
  const timestamp = now.format()
  const fileDate = now.format('ddd YY-MM-DD HH')

  const radios = await getAllActivatedRadios()

  const allRecordsResults = await Promise.all(
    radios.map(radio =>
      recordStream({ radio, day, timestamp, fileDate, deadline })
    )
  )

  for (let recordResult of allRecordsResults) {
    try {
      await saveRecord(recordResult)
    } catch (e) {
      console.error('Error uploading ', recordResult, e)
    }
  }

  for (let { tmpStreamPath } of allRecordsResults) {
    try {
      fs.unlinkSync(tmpStreamPath)
    } catch (e) {
      console.error('Error unlinking ', tmpStreamPath, e)
    }
  }

  console.log(`${new Date().toJSON()} Stream  record unit process done`)
}
