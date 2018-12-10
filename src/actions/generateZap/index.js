const moment = require('moment')
const fs = require('fs-extra')
const { uniqBy, take } = require('lodash')

const { getRandomRecords, insertZap, insertZapRadio } = require('../../models')
const {
  downloadStorageFile,
  ffmpegExtract,
  mergeMedias,
  // normalizeRecommended,
  randomNewTmpFileName,
  textToVoice,
  uploadLocalFileToStorage
} = require('../../utils')

const { GSTORAGE_ZAPS_FOLDER, ZAP_RECORD_SECONDS, ZAP_RECORDS_NB } = process.env

moment.locale('fr')

/**
 * @description Get a piece of a record
 */
async function extractRecord (record, position) {
  const { id: record_id, timestamp, record_path } = record

  // cursor in the record selected randomly from 15 seconds to the 59th minute
  const max = 59 * 60
  const min = 15
  const cursorSec = Math.floor(Math.random() * (max - min + 1)) + min

  const hourFilePath = randomNewTmpFileName('mp3')

  await downloadStorageFile(record_path, hourFilePath)

  const extractPath = await ffmpegExtract(
    hourFilePath,
    cursorSec,
    ZAP_RECORD_SECONDS
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

async function mergeAllExtracts (records) {
  const allRadioNames = records.map(r => r.name)

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

  const mergedFile = await mergeMedias(normalizedExtractPaths)

  await Promise.all(
    [...extractPaths, ...normalizedExtractPaths].map(p =>
      fs.remove(p).catch(console.error)
    )
  )

  return mergedFile
}

module.exports = async () => {
  console.log('Start zap generation')

  let records = await getRandomRecords(ZAP_RECORDS_NB * 2)
  records = take(uniqBy(records, 'name'), ZAP_RECORDS_NB)

  await Promise.all(records.map(extractRecord))

  const normalizedMergedFile = await mergeAllExtracts(records)

  const zap_path = `${GSTORAGE_ZAPS_FOLDER}/${moment().format(
    'YY-MM-DD'
  )}/${+new Date()}.mp3`
  const zap_url = await uploadLocalFileToStorage(normalizedMergedFile, zap_path)

  const [zap_id] = await insertZap({ zap_path, zap_url })
  await Promise.all(
    records.map(({ record_id, timestamp_cursor, position }) =>
      insertZapRadio({
        record_id,
        timestamp_cursor: timestamp_cursor.format(),
        position,
        zap_id
      })
    )
  )

  fs.removeSync(normalizedMergedFile)

  console.log('End zap generation', zap_url)
}
