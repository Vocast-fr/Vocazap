const moment = require('moment')
const fs = require('fs-extra')
const { uniqBy, take } = require('lodash')

const {
  getRandomRecords,
  insertZap,
  insertZapRadio,
  insertZapsInBQ
} = require('../../models')

const {
  // downloadStorageFile,
  ffmpegExtract,
  mergeMedias,
  // normalizeRecommended,
  randomNewTmpFileName,
  textToVoice
} = require('../../utils')

const { getFile, uploadFile } = require('../../utils')

const { APP_ENV, ZAP_RECORD_SECONDS, ZAP_RECORDS_NB } = process.env

moment.locale('fr')

/**
 * @description Get a piece of a record
 */
async function extractRecord(record, position) {
  const { id: record_id, timestamp, record_url } = record

  const ext = record_url.split('.').pop()

  // cursor in the record selected randomly from 15 seconds to the 59th minute
  const max = APP_ENV === 'test' ? 5 : 59 * 60
  const min = APP_ENV === 'test' ? 1 : 15
  const cursorSec = Math.floor(Math.random() * (max - min + 1)) + min

  const hourFilePath = randomNewTmpFileName(ext)

  await getFile(hourFilePath, record_url)

  const extractPath = await ffmpegExtract(
    hourFilePath,
    cursorSec,
    ZAP_RECORD_SECONDS,
    ext
  )

  fs.removeSync(hourFilePath)

  Object.assign(record, {
    cursorSec,
    extractPath,
    record_id,
    position: position + 1,
    timestamp_cursor: moment(timestamp)
      .minute(0)
      .second(0)
      .add(cursorSec, 'seconds')
  })

  return record
}

async function mergeAllExtracts(records) {
  const allRadioNames = records.map((r) => r.name)

  const extractPaths = []

  const globalIntroPath = await textToVoice(
    `Ce Vocazap est généré avec les radios suivantes : ${allRadioNames.join(
      ' , '
    )}`
  )

  extractPaths.push(globalIntroPath)

  for (let record of records) {
    try {
      const { extractPath, name, timestamp_cursor } = record
      const introPath = await textToVoice(
        `Extrait de la radio ${name} le ${timestamp_cursor.format('LLLL')}`
      )
      extractPaths.push(introPath)
      extractPaths.push(extractPath)
    } catch (e) {
      console.error('Error generating intro for extract', e, record)
    }
  }

  const voiceEndPath = await textToVoice(`Ce Vocazap est terminé.`)
  extractPaths.push(voiceEndPath)

  /*
  const normalizedExtractPaths = await Promise.all(
    extractPaths.map(extP => normalizeRecommended(extP))
  ) */

  const normalizedExtractPaths = extractPaths

  let mergedFile

  try {
    mergedFile = await mergeMedias(normalizedExtractPaths)
  } catch (e) {
    mergedFile = false
  }

  await Promise.all(
    [...extractPaths, ...normalizedExtractPaths].map((p) =>
      fs.remove(p).catch(console.error)
    )
  )

  return mergedFile
}

module.exports = async () => {
  console.log('Start zap generation')

  let records = await getRandomRecords(ZAP_RECORDS_NB * 2)
  records = take(uniqBy(records, 'name'), ZAP_RECORDS_NB)

  try {
    await Promise.all(records.map(extractRecord))

    const normalizedMergedFile = await mergeAllExtracts(records)

    const { zap_url, zap_path } = await uploadFile(
      'zap',
      normalizedMergedFile,
      `${moment().format('YY-MM-DD')}/`
    )

    const [zap_id] = await insertZap({ zap_path, zap_url })
    await Promise.all(
      records.map(({ record_id, timestamp_cursor, position }) =>
        insertZapRadio({
          record_id,
          timestamp_cursor: timestamp_cursor.format('YYYY-MM-DD HH:mm:ss'),
          position,
          zap_id
        })
      )
    )

    await insertZapsInBQ(
      records.map(
        ({
          name,
          stream_url,
          content_type,
          origin,
          radio_category,
          img,
          active,
          id,
          radio_id,
          record_url,
          record_path,
          timestamp,
          updated_at,
          position,
          timestamp_cursor
        }) => ({
          created_date: new Date(),
          record_url,
          stream_url,
          id: new Date().valueOf(),
          timestamp,
          position,
          name,
          zap_url,
          zap_id,
          zap_path,
          record_id: id,
          radio_id,
          timestamp_cursor: timestamp_cursor.format('YYYY-MM-DD HH:mm:ss')
        })
      )
    )

    fs.removeSync(normalizedMergedFile)
    console.log('End zap generation', zap_url)
  } catch (e) {
    console.log('Error on zap generation, no zap file')
  }
}
