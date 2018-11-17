const cron = require('node-cron')
const streamRecording = require('./actions/streamRecording')
const clean = require('./actions/clean')

process.on('uncaughtException', err =>
  console.error('unhandled exception', err)
)
process.on('unhandledRejection ', err =>
  console.error('unhandled rejection', err)
)

cron.schedule('0 * * * *', () => {
  streamRecording().catch(e =>
    console.error('Main error for stream recording', e)
  )
})

cron.schedule('30 * * * *', () => {
  clean().catch(e => console.error('Main error for clean', e))
})
