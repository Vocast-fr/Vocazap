require('dotenv').config()

const moment = require('moment')

const { getKnexConnection } = require('../../utils/mysql')

const {
  BQ_GC_PROJECT,
  BQ_GC_KEYFILENAME,
  BQ_ZAPS_DATASET,
  BQ_ZAPS_TABLE,
  NB_DAYS_ZAPS_EXP,
  TABLE_ZAPS,
  TABLE_ZAPS_RADIOS,
  VIEW_ZAPS
} = process.env

const { BigQuery } = require('@google-cloud/bigquery')

const bigquery = new BigQuery({
  projectId: BQ_GC_PROJECT,
  keyFilename: BQ_GC_KEYFILENAME
})

const _oldZapOp = (op) => {
  const knexCon = getKnexConnection()

  return knexCon[op]()
    .where(
      'created_date',
      '<',
      moment()
        .subtract(NB_DAYS_ZAPS_EXP, 'd')
        .format()
    )
    .table(TABLE_ZAPS)
}

const delOldZaps = () => _oldZapOp('del')

const deleteSpecificZap = (id) => {
  const knexCon = getKnexConnection()

  return knexCon['delete']()
    .where('id', '=', id)
    .table(TABLE_ZAPS)
}

const getOldZaps = () => _oldZapOp('select')

const getRandomZaps = (limit) =>
  getKnexConnection()
    .select()
    .from(VIEW_ZAPS)
    .where('position', '=', 1)
    .orderByRaw('RAND()')
    .limit(limit)

const insertZap = (data) =>
  getKnexConnection()
    .insert(data)
    .table(TABLE_ZAPS)

const insertZapRadio = (data) =>
  getKnexConnection()
    .insert(data)
    .table(TABLE_ZAPS_RADIOS)

const insertZapsInBQ = (rows) =>
  bigquery
    .dataset(BQ_ZAPS_DATASET)
    .table(BQ_ZAPS_TABLE)
    .insert(rows)

module.exports = {
  deleteSpecificZap,
  delOldZaps,
  getOldZaps,
  getRandomZaps,
  insertZap,
  insertZapRadio,
  insertZapsInBQ
}
