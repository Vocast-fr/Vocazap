const fs = require('fs')
const os = require('os')

require('dotenv').config()

const { SERVE_FOLDER, NB_DAYS_RECORDS_EXP } = process.env
const moment = require('moment')

const {
  deleteSpecificStreamRecord,
  deleteSpecificZap,
  getOldRadioStreams,
  getOldZaps
} = require('../../models')
const { deleteFile } = require('../../interfaces')

const { search, deleteFileById } = require('../../utils/drive')

async function cleanOldFolders() {
  try {
    let nb = 0
    const dayString = moment()
      .subtract(NB_DAYS_RECORDS_EXP, 'd')
      .format('YY-MM-DD')

    const q = `trashed=false and name='${dayString}' and mimeType='application/vnd.google-apps.folder'`

    const files = await search(q)
    // console.log(files)

    for (const { id } of files) {
      await deleteFileById(id)
      nb++
    }
    console.log(nb, ' old folders deleted')
  } catch (e) {
    console.error(`Cannot delete old folder : ${e}`)
  }
}

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
  regex = /(_.*([.]mp3)$)|(_.*([.]aac))$/
  fs.readdirSync(path)
    .filter((f) => regex.test(f))
    .map((f) => fs.unlinkSync(`${path}${f}`))

  await Promise.all([
    removeOldRadioStreams(),
    removeOldZaps(),
    cleanOldFolders()
  ])
}
