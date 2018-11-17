require('dotenv').config()

const moment = require('moment')

const { getKnexConnection } = require('../../utils/mysql')

const { NB_EXP_STREAM_RECORDS_EXP_DAY, TABLE_STREAM_RECORDS } = process.env

const getAllStreamRecords = () =>
  getKnexConnection()
    .select()
    .table(TABLE_STREAM_RECORDS)

const delOldRadioStreams = () => oldRadioStreamsOp('del')

const getOldRadioStreams = () => oldRadioStreamsOp('select')

const oldRadioStreamsOp = op => {
  const knewCon = getKnexConnection()

  return knewCon[op]()
    .where(
      'timestamp',
      '<',
      moment().subtract(NB_EXP_STREAM_RECORDS_EXP_DAY, 'd').format()
    )
    .table(TABLE_STREAM_RECORDS)
}

const insertRadioStreamsRecords = data =>
  getKnexConnection()
    .insert(data)
    .table(TABLE_STREAM_RECORDS)

module.exports = {
  delOldRadioStreams,
  getOldRadioStreams,
  getAllStreamRecords,
  insertRadioStreamsRecords
}
