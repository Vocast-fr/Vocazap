const { uploadFile } = require('./src/utils')

uploadFile('test', './package.json', '').then(console.log).catch(console.error)
