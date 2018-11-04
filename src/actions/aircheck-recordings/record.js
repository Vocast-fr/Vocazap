const cron = require('node-cron')
const fs = require('fs')
const moment = require('moment')
const os = require('os')
const request = require('superagent')

const { uploadLocalFileToS3 } = require('./utils/s3')

// process.on('uncaughtException', err => console.error('unhandled exception'))
// process.on('unhandledRejection ', err => console.error('unhandled rejection'))

moment.locale('fr')

function recordStream ({ name, url, timestamp }) {
  return new Promise((resolve, reject) => {
    const recordName = `${name}@${timestamp.format('ddd YY-MM-DD HH:mm')}`
    const recordFile = `${recordName}.mp3`
    const tmpStreamPath = `${os.tmpdir()}/${recordFile}`
    const stream = fs.createWriteStream(tmpStreamPath)

    stream.on('close', () => {
      console.log(`${new Date()}:: Stream closed : ${recordFile}`)
    })
    stream.on('error', e => {
      console.error(`${new Date()}:: Stream errored`, { e, recordFile, url })
      resolve(tmpStreamPath)
    })

    // console.log("ready", { name, url });
    request
      .get(url)
      .timeout({
        deadline: 60000 * 60 // load during one hour
      })
      .on('response', res => {
        console.log(`${new Date()}:: Res request for ${recordFile}`, res)
      })
      .on('end', end => {
        console.log(`${new Date()}:: End request for ${recordFile}, `, end)
      })
      .on('error', e => {
        const success = e.timeout
        if (success) {
          console.log(`${new Date()}:: Success timeout for ${recordFile}`)

          const day = timestamp.format('YY-MM-DD')
          uploadLocalFileToS3(
            tmpStreamPath,
            `pigeTest/${name}/${day}/${recordFile}`
          )
            .then(() => {
              console.log(`${new Date()}:: Stream uploaded for ${recordFile}`)
              resolve(tmpStreamPath)
            })
            .catch(e => {
              console.error(`${new Date()}:: ERROR upload: ${recordFile}`, e)
              resolve(tmpStreamPath)
            })
        } else {
          console.error(`Error on request: ${e}`, { name, url })
          resolve(tmpStreamPath)
        }
      })
      .pipe(stream)
  })
}

function main (radios) {
  const timestamp = moment()

  Promise.all(
    radios.map(radio =>
      recordStream(Object.assign(radio, timestamp))
        .then(fs.unlinkSync)
        .catch(e => console.error(`Error on record/unlink ${e}`))
    )
  ).catch(console.error)
}

cron.schedule('4 * * * *', () => {
  try {
    console.log('running a task every hour')
    main()
  } catch (e) {
    console.error('Main error', e)
  }
})
