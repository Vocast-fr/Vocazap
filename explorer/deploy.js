const { uploadLocalFileToS3 } = require('../src/utils')

uploadLocalFileToS3('./src/index.html', '')
  .then(() => console.log('explorer index file uploaded to S3'))
  .catch(e => console.error('Explorer deployment failed', e))
