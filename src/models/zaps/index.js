require('dotenv').config()

const moment = require('moment')

const { getKnexConnection } = require('../../utils/mysql')

const {
  NB_DAYS_ZAPS_EXP,
  TABLE_ZAPS,
  TABLE_ZAPS_RADIOS,
  VIEW_ZAPS
} = process.env

const _oldZapOp = op => {
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

const deleteSpecificZap = id => {
  const knexCon = getKnexConnection()

  return knexCon['delete']()
    .where('id', '=', id)
    .table(TABLE_ZAPS)
}

const getOldZaps = () => _oldZapOp('select')

const getRandomZaps = limit =>
  getKnexConnection()
    .select()
    .from(VIEW_ZAPS)
    .where('position', '=', 1)
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
  deleteSpecificZap,
  delOldZaps,
  getOldZaps,
  getRandomZaps,
  insertZap,
  insertZapRadio
}
