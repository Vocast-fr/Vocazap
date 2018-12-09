require('dotenv').config()

const moment = require('moment')

const { getKnexConnection } = require('../../utils/mysql')

const {
  NB_DAYS_RECORDS_EXP,
  TABLE_ZAPS,
  TABLE_ZAPS_RADIOS,
  VIEW_ZAPS
} = process.env

const _oldZapOp = op => {
  const knewCon = getKnexConnection()

  return knewCon[op]()
    .where(
      'created_date',
      '<',
      moment()
        .subtract(NB_DAYS_RECORDS_EXP, 'd')
        .format()
    )
    .table(TABLE_ZAPS)
}

const delOldRadioStreams = () => _oldZapOp('del')

const getOldRadioStreams = () => _oldZapOp('select')

const getRandomZaps = limit =>
  getKnexConnection()
    .select()
    .from(VIEW_ZAPS)
    .orderByRaw('RAND()')
    .limit(limit)

const insertZap = data =>
  getKnexConnection()
    .insert(data)
    .table(TABLE_ZAPS)

const insertZapRadio = data =>
  getKnexConnection()
    .insert(data)
    .table(TABLE_ZAPS_RADIOS)

module.exports = {
  delOldRadioStreams,
  getOldRadioStreams,
  getRandomZaps,
  insertZap,
  insertZapRadio
}
