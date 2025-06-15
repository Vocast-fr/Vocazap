require('dotenv').config();

const request = require('superagent');

const { PIXELDRAIN_API_KEY } = process.env;

async function deleteFile(url) {}

let currentApiKeyIndex = 0;

function getNextPixelDrainApiKey() {
  const pixelDrainApiKeys = process.env.PIXELDRAIN_API_KEY.split(' ');
  const key = pixelDrainApiKeys[currentApiKeyIndex];
  currentApiKeyIndex = (currentApiKeyIndex + 1) % pixelDrainApiKeys.length;
  return key;
}

function getFile(localPathFile, remoteUrl) {}

async function uploadFile(type, filepath, foldersPath = '', filename) {
  const result = {};

  if (!filename) {
    filename = filepath.split('/').pop();
  }

  const { text } = await request
    .post('https://pixeldrain.com/api/file')
    .set('Authorization', 'Basic ' + Buffer.from(':' + getNextPixelDrainApiKey()).toString('base64'))
    .attach('file', filepath)
    .field('name', filename);

  const { id } = JSON.parse(text);

  result[`${type}_url`] = `https://pixeldrain.com/api/file/${id}?download`;
  result[`${type}_path`] = id;

  return result;
}

module.exports = {
  deleteFile,
  getFile,
  uploadFile,
};
