require('dotenv').config()

const cron = require('node-cron')
const express = require('express')

const clean = require('./src/actions/clean')
const generateZap = require('./src/actions/generateZap')
const streamRecording = require('./src/actions/streamRecording')

const { getRandomZaps } = require('./src/models')

process.on('uncaughtException', err =>
  console.error('unhandled exception', err)
)
process.on('unhandledRejection ', err =>
  console.error('unhandled rejection', err)
)

cron.schedule('0 * * * *', () => {
  // 60000 = 1 min
  const timelength = 60000 * 60
  streamRecording(timelength).catch(e =>
    console.error('Main error for stream recording', e)
  )
})

/*
cron.schedule('30 * * * *', () => {
  clean().catch(e => console.error('Main error for clean', e))
})

cron.schedule('15,45 * * * *', () => {
  generateZap().catch(e => console.error('Main error for zap generation', e))
})

const app = express()

app.get('/', function (req, res) {
  getRandomZaps(1)
    .then(([zap]) => res.json({ date: new Date(), zap }))
    .catch(e => {
      console.error('getting random zap error', e)
      res.json({ e })
    })
})

const port = process.env.PORT || 3000

app.listen(port, function () {
  console.log(`Vocazap process launched. Port = ${port}`)
})
*/