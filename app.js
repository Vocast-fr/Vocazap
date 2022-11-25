require('dotenv').config()

const cron = require('node-cron')

const clean = require('./src/actions/clean')
const generateZap = require('./src/actions/generateZap')
const streamRecording = require('./src/actions/streamRecording')

const { APP_ENV, DEADLINE_RECORDS_MINUTES } = process.env

process.on('uncaughtException', (err) => {
  // console.error('unhandled exception', err)
})
process.on('unhandledRejection ', (err) => {
  // console.error('unhandled rejection', err)
})

if (APP_ENV === 'test') {
  streamRecording(6000, false).catch((e) =>
    console.error('Main error for stream recording', e)
  )

  // generateZap().catch(e => console.error('Main error for zap generation', e))
  // clean().catch((e) => console.error('Main error for clean', e))
} else {
  cron.schedule('0 * * * *', () => {
    // 60000 = 1 min ||| 61 * 60000
    const timelength = DEADLINE_RECORDS_MINUTES * 60000
    streamRecording(timelength).catch((e) =>
      console.error('Main error for stream recording', e)
    )
  })

  cron.schedule('30 * * * *', () => {
    clean().catch((e) => console.error('Main error for clean', e))
  })

  console.log('Vocazap process started - production mode')

  /*
  cron.schedule('45 * * * *', () => {
    generateZap().catch((e) =>
      console.error('Main error for zap generation', e)
    )
  })
*/
}
