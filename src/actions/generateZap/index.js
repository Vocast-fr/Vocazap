const moment = require('moment')

const fs = require('fs-extra')

const { getRandomRecords, insertZap, insertZapRadio } = require('../../models')
const {
  ffmpegExtract,
  mergeMedias,
  //  normalizeRecommended,
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
  const { id: record_id, timestamp, record_url } = record

  // cursor in the record selected randomly from 15 seconds to the 59th minute
  const max = 59 * 60
  const min = 15
  const cursorSec = Math.floor(Math.random() * (max - min + 1)) + min

  const extractPath = await ffmpegExtract(
    record_url,
    cursorSec,
    ZAP_RECORD_SECONDS
  )

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

  const mergedFile = await mergeMedias(extractPaths)

  await Promise.all(
    extractPaths.map(async p => {
      fs.removeSync(p)
    })
  )

  return mergedFile
}

module.exports = async () => {
  console.log('Start zap generation')
  // const records = await getRandomRecords(ZAP_RECORDS_NB)

  const records = [
    {
      name: 'Africa Numéro 1',
      record_url:
        'https://s3.eu-west-3.amazonaws.com/vocazap/piges/Africa+N%C2%B01/18-11-17/Africa+N%C2%B01%40sam.+18-11-17+02.mp3'
    },
    {
      name: 'BFM Business',
      record_url:
        'https://s3.eu-west-3.amazonaws.com/vocazap/piges/BFM+Business/18-11-17/BFM+Business%40sam.+18-11-17+03.mp3'
    },
    {
      name: 'Dreyeckland',
      record_url:
        'https://s3.eu-west-3.amazonaws.com/vocazap/piges/Dreyeckland/18-11-17/Dreyeckland%40sam.+18-11-17+06.mp3'
    },
    {
      name: 'Chérie',
      record_url:
        'https://s3.eu-west-3.amazonaws.com/vocazap/piges/Cherie+FM/18-11-17/Cherie+FM%40sam.+18-11-17+07.mp3'
    }
  ]

  await Promise.all(records.map(extractRecord))
  const mergedFile = await mergeAllExtracts(records)
  const normalizedMergedFile = mergedFile // await normalizeRecommended(mergedFile)

  const zap_path = `${GSTORAGE_ZAPS_FOLDER}/${moment().format(
    'YY-MM-DD'
  )}/${+new Date()}`
  const zap_url = await uploadLocalFileToStorage(normalizedMergedFile, zap_path)

  const [zap_id] = await insertZap({ zap_path, zap_url })
  await records.map(({ record_id, timestamp_cursor, position }) =>
    insertZapRadio({
      record_id,
      timestamp_cursor: timestamp_cursor.format(),
      position,
      zap_id
    })
  )

  // fs.removeSync(mergedFile)
  fs.removeSync(normalizedMergedFile)

  console.log('End zap generation', zap_id)
}
