const ffmpeg = require('./ffmpeg')
const gstorage = require('./gstorage')
const mysql = require('./mysql')
const s3 = require('./s3')
const xml = require('./xml')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

module.exports = {
  sleep,
  ...ffmpeg,
  ...gstorage,
  ...mysql,
  ...s3,
  ...xml
}
