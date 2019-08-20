require('dotenv').config()

const fs = require('fs-extra')
const request = require('superagent')

const {
  deleteFileById,
  deleteStorageFile,
  uploadFileAccordingPath,
  uploadLocalFileToStorage
} = require('../../utils')

const { STORAGE_MODE } = process.env

async function deleteFile (url) {
  if (url.includes('https://storage.googleapis.com/')) {
    let filename = url.split('https://storage.googleapis.com/')[1].split('/')
    filename.shift()
    filename.join('/')
    await deleteStorageFile(filename)
  } else if (url.includes('drive.google.com')) {
    const fileId = url.split('=')[1].split('&')[0]
    await deleteFileById(fileId)
  }
}

function getFile (filepath, url) {
  // if (STORAGE_MODE === 'gstorage') await downloadStorageFile(record_path, hourFilePath)

  const stream = fs.createWriteStream(filepath)

  return new Promise((resolve, reject) => {
    request
      .get(url)
      .on('end', () => {
        stream.close()
        resolve()
      })
      .on('error', e => {
        stream.close()
        reject(e)
      })
      .pipe(stream)
  })
}

// type = record or zap
// STORAGE_MODE === 'drive' or 'gstorage'
async function uploadFile (type, filepath, foldersPath = '') {
  const result = {}

  const recordFile = filepath.split('/').pop()

  const mainFolderValue =
    `${STORAGE_MODE.toUpperCase()}` + '_' + type.toUpperCase() + 'S_FOLDER'

  result[`${type}_path`] = process.env[mainFolderValue] + `/${foldersPath}`

  const folderPath = result[`${type}_path`]
  result[`${type}_path`] = result[`${type}_path`] + recordFile

  result[`${type}_url`] =
    STORAGE_MODE === 'drive'
      ? await uploadFileAccordingPath(folderPath, recordFile, filepath)
      : await uploadLocalFileToStorage(filepath, result[`${type}_path`])

  return result
}

module.exports = {
  deleteFile,
  getFile,
  uploadFile
}
