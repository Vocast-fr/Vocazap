require('dotenv').config()

const moment = require('moment')

const { getKnexConnection } = require('../../utils/mysql')

const { BigQuery } = require('@google-cloud/bigquery')

const {
  BQ_GC_PROJECT,
  BQ_GC_KEYFILENAME,
  BQ_RECORDS_DATASET,
  BQ_RECORDS_TABLE,
  NB_DAYS_RECORDS_EXP,
  TABLE_STREAM_RECORDS,
  VIEW_RECORDS
} = process.env

const bigquery = new BigQuery({
  projectId: BQ_GC_PROJECT,
  keyFilename: BQ_GC_KEYFILENAME
})

const _oldRadioStreamsOp = (op) => {
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

const deleteSpecificStreamRecord = (id) => {
  const knexCon = getKnexConnection()

  return knexCon['delete']()
    .where('id', '=', id)
    .table(TABLE_STREAM_RECORDS)
}

const getOldRadioStreams = () => _oldRadioStreamsOp('select')

const getRandomRecords = (limit) =>
  getKnexConnection()
    .select()
    .from(VIEW_RECORDS)
    .orderByRaw('RAND()')
    .limit(limit)

const insertRadioStreamsRecords = (data) =>
  getKnexConnection()
    .insert(data)
    .table(TABLE_STREAM_RECORDS)

const insertRadioStreamsInBQ = (rows) =>
  bigquery
    .dataset(BQ_RECORDS_DATASET)
    .table(BQ_RECORDS_TABLE)
    .insert(rows)

module.exports = {
  deleteSpecificStreamRecord,
  delOldRadioStreams,
  getOldRadioStreams,
  getRandomRecords,
  insertRadioStreamsRecords,
  insertRadioStreamsInBQ
}
