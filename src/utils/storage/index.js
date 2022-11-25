require('dotenv').config()

const request = require('superagent')

const { PIXELDRAIN_API_KEY } = process.env

async function deleteFile(url) {}

function getFile(localPathFile, remoteUrl) {}

async function uploadFile(type, filepath, foldersPath = '', filename) {
  const result = {}

  if (!filename) {
    filename = filepath.split('/').pop()
  }

  /* 
  console.log({
    buf: 'Basic ' + Buffer.from(':' + PIXELDRAIN_API_KEY).toString('base64'),
    btoa: 'Basic ' + btoa(':' + PIXELDRAIN_API_KEY)
  })
  */

  const { text } = await request
    .post(`https://pixeldrain.com/api/file`)
    .set(
      'Authorization',
      'Basic ' + Buffer.from(':' + PIXELDRAIN_API_KEY).toString('base64')
    )
    .attach('file', filepath)
    .field('name', filename)

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
