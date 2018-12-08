const moment = require('moment')

const { getRandomRecords } = require('../../models')
const { ffmpegExtract } = require('../../utils')

const { ZAP_RECORD_SECONDS, ZAP_RECORDS_NB } = process.env

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
      .format()
  })

  return record
}

module.exports = async () => {
  const records = await getRandomRecords(ZAP_RECORDS_NB)
  const record = await extractRecord({ id: '444444', timestamp: undefined, record_url: 'https://s3.eu-west-3.amazonaws.com/vocazap/piges/100+%25+Albi/18-11-17/100+%25+Albi%40sam.+18-11-17+02.mp3' })  
  //  Promise.all(records.map(extractRecord))
  console.log({ record })
}
