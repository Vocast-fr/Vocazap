require('dotenv').config()
const { upsertDatas, getKnexConnection } = require('../../utils/mysql')

const { TABLE_RADIOS } = process.env
const NAME = 'name'

const getAllRadios = () =>
  getKnexConnection()
    .select()
    .table(TABLE_RADIOS)
const upsertRadios = radios => upsertDatas(TABLE_RADIOS, [NAME], radios)

module.exports = {
  getAllRadios,
  upsertRadios
}
