const express = require('express')

const { getRandomZaps } = require('./src/models')

const app = express()

app.get('/', function (req, res) {
  res.send('Welcome to the Vocast API ! ')
})

app.get('/randomzap', function (req, res) {
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
