require('dotenv').config()

const {
  uploadFileAccordingPath,
  uploadLocalFileToStorage
} = require('../../utils')

const { STORAGE_MODE } = process.env

// type = record or zap
// STORAGE_MODE === 'drive' or 'gstorage'

async function uploadFile (type, filepath, foldersPath = '') {
  const result = {}

  const recordFile = filepath.split['/'].pop()

  const mainFolderValue =
    `${STORAGE_MODE.toUpperCase()}` + '_' + type.toUpperCase() + 'S_FOLDER'

  result[`${type}_path`] =
    process.env[mainFolderValue] + `/${foldersPath}` + recordFile

  const folderPath = result[`${type}_path`]
  result[`${type}_path`] = result[`${type}_path`] + recordFile

  const mimeType = 'audio/mpeg'

  result[`${type}_url`] =
    STORAGE_MODE === 'drive'
      ? await uploadFileAccordingPath(
        folderPath,
        recordFile,
        filepath,
        mimeType
      )
      : await uploadLocalFileToStorage(filepath, result[`${type}_path`])

  return result
}

async function removeFile () {}

module.exports = {
  uploadFile,
  removeFile
}
