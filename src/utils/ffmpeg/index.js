const Chance = require('chance')
const ffmpegPath = '/opt/ffmpeg/ffmpeg-4.1-64bit-static/ffmpeg'  // require('@ffmpeg-installer/ffmpeg').path
const ffmpeg = require('fluent-ffmpeg')
const normalize = require('ffmpeg-normalize')
const os = require('os')

const chance = new Chance()

const TMP_PATH = os.tmpdir()

ffmpeg.setFfmpegPath(ffmpegPath)

async function ffmpegExtract (input, startSec, durationSec) {
  return new Promise(async (resolve, reject) => {
    const output = `${TMP_PATH}/${chance.hash()}.mp3`

    ffmpeg(input)
      .setStartTime(startSec)
      .setDuration(durationSec)
      .output(output)
      .on('end', () => resolve(output))
      .on('error', err => {
        console.error('ffmpeg error::', err)
        reject(err)
      })
      .run()
  })
}

function normalizeRecommended (inputPath, outputPath) {
  return normalize({
    input: inputPath,
    output: outputPath,
    loudness: {
      normalization: 'ebuR128',
      target: {
        input_i: -16,
        input_lra: 11,
        input_tp: -1.5
      }
    }
  })
}

module.exports = {
  ffmpegExtract,
  normalizeRecommended
}
