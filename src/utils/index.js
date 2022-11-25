const ffmpeg = require('./ffmpeg')
const mysql = require('./mysql')
const polly = require('./polly')
const random = require('./random')
const gstorage = require('./storage')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

module.exports = {
  sleep,
  ...ffmpeg,
  ...gstorage,
  ...mysql,
  ...polly,
  ...random
}
