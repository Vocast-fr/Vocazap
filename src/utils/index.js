const drive = require('./drive')
const ffmpeg = require('./ffmpeg')
const gstorage = require('./gstorage')
const mysql = require('./mysql')
const polly = require('./polly')
const random = require('./random')
const s3 = require('./s3')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

module.exports = {
  sleep,
  ...drive,
  ...ffmpeg,
  ...gstorage,
  ...mysql,
  ...polly,
  ...random,
  ...s3
}
