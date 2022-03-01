const fs = require('fs')
const os = require('os')

require('dotenv').config()

const { SERVE_FOLDER } = process.env

const {
  deleteSpecificStreamRecord,
  deleteSpecificZap,
  getOldRadioStreams,
  getOldZaps
} = require('../../models')
const { deleteFile } = require('../../interfaces')

async function removeOldRadioStreams() {
  try {
    const oldRadiosStreams = await getOldRadioStreams()

    for (let { id, record_url } of oldRadiosStreams) {
      try {
        await deleteFile(record_url)
        await deleteSpecificStreamRecord(id)
      } catch (e) {
        console.error(`Cannot delete stream record ${record_url} : ${e}`)
      }
    }

    console.log('clean records done')
  } catch (err) {
    console.error('Error when trying to remove old radio streams', err)
  }
}

async function removeOldZaps() {
  try {
    const oldZaps = await getOldZaps()

    for (let { id, zap_url } of oldZaps) {
      try {
        await deleteFile(zap_url)
        await deleteSpecificZap(id)
      } catch (e) {
        console.error(`Cannot delete zap ${zap_url} : ${e}`)
      }
    }

    console.log('clean zaps done')
  } catch (err) {
    console.error('Error when trying to remove old radio streams', err)
  }
}

module.exports = async () => {
  let path = `${os.tmpdir()}/`
  let regex = /([.]mp3)$|([.]aac)$/
  fs.readdirSync(path)
    .filter((f) => regex.test(f))
    .map((f) => fs.unlinkSync(`${path}${f}`))

  path = `${SERVE_FOLDER}/`
  regex = /_.*([.]mp3)$|([.]aac)$/
  fs.readdirSync(path)
    .filter((f) => regex.test(f))
    .map((f) => fs.unlinkSync(`${path}${f}`))
  await Promise.all([removeOldRadioStreams(), removeOldZaps()])
}
