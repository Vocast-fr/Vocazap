const normalize = require('ffmpeg-normalize')

function normalizeMP3 (inputPath, outputPath) {
  normalize({
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
    .then(normalized => {
      console.log('ok normalized ')
    })
    .catch(error => {
      console.error('normalization error ', error)
    })
}

module.exports = {
  normalizeMP3
}
