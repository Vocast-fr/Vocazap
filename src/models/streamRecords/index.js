require('dotenv').config()

const moment = require('moment')

const { getKnexConnection } = require('../../utils/mysql')

const { NB_DAYS_RECORDS_EXP, TABLE_STREAM_RECORDS, VIEW_RECORDS } = process.env

const _oldRadioStreamsOp = op => {
  const knewCon = getKnexConnection()

  return knewCon[op]()
    .where(
      'timestamp',
      '<',
      moment()
        .subtract(NB_DAYS_RECORDS_EXP, 'd')
        .format()
    )
    .table(TABLE_STREAM_RECORDS)
}

const delOldRadioStreams = () => _oldRadioStreamsOp('del')

const getOldRadioStreams = () => _oldRadioStreamsOp('select')

const getRandomRecords = limit =>
  getKnexConnection()
    .select()
    .from(VIEW_RECORDS)
    .orderByRaw('RAND()')
    .limit(limit)

const insertRadioStreamsRecords = data =>
  getKnexConnection()
    .insert(data)
    .table(TABLE_STREAM_RECORDS)

module.exports = {
  delOldRadioStreams,
  getOldRadioStreams,
  getRandomRecords,
  insertRadioStreamsRecords
}
