require('dotenv').config()

const request = require('superagent')

const { PIXELDRAIN_API_KEY } = process.env

async function deleteFile(url) {}

function getFile(localPathFile, remoteUrl) {}

async function uploadFile(type, filepath, foldersPath = '', recordFile) {
  const result = {}

  if (!recordFile) {
    recordFile = filepath.split('/').pop()
  }

  const { text } = await request
    .post(`https://pixeldrain.com/api/file`)
    .set(
      'Authorization',
      // 'Basic ' + Buffer.from(':' + PIXELDRAIN_API_KEY, 'base64')
      'Basic ' + btoa(':' + PIXELDRAIN_API_KEY)
    )
    .attach('file', filepath)
    .field('name', recordFile)

  const { id } = JSON.parse(text)

  result[`${type}_url`] = `https://pixeldrain.com/api/file/${id}?download`
  result[`${type}_path`] = id

  return result
}

module.exports = {
  deleteFile,
  getFile,
  uploadFile
}
