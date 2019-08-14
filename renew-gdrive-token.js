require('dotenv').config()

const { getDriveSetUp } = require('./src/utils/drive')

getDriveSetUp()
  .then(() => console.log('OK!'))
  .catch(e => console.error(`Error getting token for drive setup`, e))
