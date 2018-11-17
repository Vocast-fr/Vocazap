require('dotenv').config()
const { upsertDatas, getKnexConnection } = require('../../utils/mysql')

const { TABLE_RADIOS } = process.env
const NAME = 'name'
const ACTIVE = 'active'

const getAllRadios = () =>
  getKnexConnection()
    .select()
    .table(TABLE_RADIOS)

const getAllActivatedRadios = () =>
  getKnexConnection()
    .select()
    .where({ [ACTIVE]: true })
    .table(TABLE_RADIOS)

const upsertRadios = radios => upsertDatas(TABLE_RADIOS, [NAME], radios)

module.exports = {
  getAllActivatedRadios,
  getAllRadios,
  upsertRadios
}
