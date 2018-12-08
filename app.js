require('dotenv').config()

const cron = require('node-cron')

const clean = require('./src/actions/clean')
const generateZap = require('./src/actions/generateZap')
const streamRecording = require('./src/actions/streamRecording')

process.on('uncaughtException', err =>
  console.error('unhandled exception', err)
)
process.on('unhandledRejection ', err =>
  console.error('unhandled rejection', err)
)

// cron.schedule('0 * * * *', () => {
// streamRecording().catch(e =>
//  console.error('Main error for stream recording', e)
// )
// })

// cron.schedule('15-45/30 * * * *', () => {
generateZap().catch(e => console.error(new Date(), ' Main error ', e))
// })

/*
cron.schedule('30 * * * *', () => {
  clean().catch(e => console.error('Main error for clean', e))
})
*/
