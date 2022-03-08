require('dotenv').config()

const cron = require('node-cron')

const express = require('express')
const bodyParser = require('body-parser')
const url = require('url')
const querystring = require('querystring')

const clean = require('./src/actions/clean')
const generateZap = require('./src/actions/generateZap')
const streamRecording = require('./src/actions/streamRecording')

const { ddlProxy, search } = require('./src/utils/drive')

const { APP_ENV, DEADLINE_RECORDS_MINUTES, DDL_HOST, PORT } = process.env

process.on('uncaughtException', (err) =>
  console.error('unhandled exception', err)
)
process.on('unhandledRejection ', (err) =>
  console.error('unhandled rejection', err)
)

const app = express()
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.get('/', (req, res) => {
  res.send(`${new Date()} : Vocazap process is alive !`)
})

// Route for downloading google file
app.get('/ddlPige', (req, res) => {
  const { fileId, fileName } = req.query
  ddlProxy(fileId, fileName, res)
})

app.listen(PORT, function() {
  console.log(`Vocazap process started on ${DDL_HOST}, PORT=${PORT}`)
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

  cron.schedule('45 * * * *', () => {
    generateZap().catch((e) =>
      console.error('Main error for zap generation', e)
    )
  })
}
