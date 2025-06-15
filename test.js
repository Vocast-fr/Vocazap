const { uploadFile } = require('./src/utils')

uploadFile('test', './test.mp3', '').then(console.log).catch(console.error)
