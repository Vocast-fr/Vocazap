require('dotenv').config()

const moment = require('moment')

const { getKnexConnection } = require('../../utils/mysql')

const { NB_DAYS_RECORDS_EXP, TABLE_STREAM_RECORDS, VIEW_RECORDS } = process.env

const _oldRadioStreamsOp = op => {
  const knexCon = getKnexConnection()

  return knexCon[op]()
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

const deleteSpecificStreamRecord = id => {
  const knexCon = getKnexConnection()

  return knexCon['delete']()
    .where('id', '=', id)
    .table(TABLE_STREAM_RECORDS)
}

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
  deleteSpecificStreamRecord,
  delOldRadioStreams,
  getOldRadioStreams,
  getRandomRecords,
  insertRadioStreamsRecords
}
