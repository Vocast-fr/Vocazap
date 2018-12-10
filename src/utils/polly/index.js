require('dotenv').config()

const aws = require('aws-sdk')
const fs = require('fs-extra')

const { randomNewTmpFileName } = require('../random')

const { AWS_ACCESS_KEY, AWS_SECRET_KEY } = process.env

const polly = new aws.Polly({
  credentials: {
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_KEY
  },
  region: 'eu-west-3'
})

function textToVoice (Text, VoiceId = 'Lea', OutputFormat = 'mp3') {
  return new Promise((resolve, reject) => {
    polly.synthesizeSpeech(
      {
        Text: '<speak><prosody volume="x-loud">' + Text + '</prosody></speak>',
        TextType: 'ssml',
        OutputFormat,
        VoiceId
      },
      (err, data) => {
        if (err) {
          reject(err)
        } else if (data) {
          try {
            const output = randomNewTmpFileName(OutputFormat)
            fs.writeFileSync(output, data.AudioStream)
            resolve(output)
          } catch (e) {
            reject(e)
          }
        }
      }
    )
  })
}

module.exports = {
  textToVoice
}
