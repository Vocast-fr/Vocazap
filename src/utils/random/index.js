const Chance = require('chance')
const os = require('os')

const chance = new Chance()

const TMP_PATH = os.tmpdir()

function randomNewTmpFileName (ext = 'mp3') {
  return `${TMP_PATH}/${chance.hash()}.${ext}`
}

module.exports = {
  randomNewTmpFileName
}
