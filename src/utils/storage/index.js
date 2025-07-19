require('dotenv').config();

const request = require('superagent');

const { PIXELDRAIN_API_KEYS } = process.env;

const CURRENT_ACCOUNT_OFFSET = 0;
const CLEAN_ACCOUNT_OFFSET = 1;

function getWeekNumber(date = new Date()) {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDays = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
  return Math.ceil((pastDays + startOfYear.getDay() + 1) / 7);
}

function getPixelDrainApiKey(offset = CURRENT_ACCOUNT_OFFSET) {
  const pixelDrainApiKeys = PIXELDRAIN_API_KEYS.split(',');
  const weekNumber = getWeekNumber();
  const apiKeyIndex = (weekNumber + offset) % pixelDrainApiKeys.length;
  const key = pixelDrainApiKeys[apiKeyIndex];
  return key;
}

async function deleteFile(url) {}

function getFile(localPathFile, remoteUrl) {}

async function deleteOldFiles() {
  const headerAuthclean = 'Basic ' + Buffer.from(':' + getPixelDrainApiKey(CLEAN_ACCOUNT_OFFSET)).toString('base64');

  const { text } = await request.get('https://pixeldrain.com/api/user/files').set('Authorization', headerAuthclean);
  const { files } = JSON.parse(text);

  for (const { date_upload, id } of files) {
    try {
      const dateUpload = new Date(date_upload);
      const currentDate = new Date();
      const diffTime = Math.abs(currentDate - dateUpload);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 30) {
        await request.delete(`https://pixeldrain.com/api/file/${id}`).set('Authorization', headerAuthclean);
        // console.log(`Deleted file with id ${id} uploaded on ${date_upload} (${diffDays} days old)`);
      }
    } catch (error) {
      console.error(`Error deleting file with id ${id}:`, error);
    }
  }
}

async function uploadFile(type, filepath, foldersPath = '', filename) {
  const result = {};

  if (!filename) {
    filename = filepath.split('/').pop();
  }

  const { text } = await request
    .post('https://pixeldrain.com/api/file')
    .set('Authorization', 'Basic ' + Buffer.from(':' + getPixelDrainApiKey()).toString('base64'))
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
  deleteOldFiles,
};
