require('dotenv').config()

const ffmpeg = require('fluent-ffmpeg')
// const normalize = require('ffmpeg-normalize')

const { randomNewTmpFileName } = require('../random')

const { FFPROBE_PATH, FFMPEG_PATH } = process.env

const ffmpegPath = FFMPEG_PATH || require('@ffmpeg-installer/ffmpeg').path
ffmpeg.setFfmpegPath(ffmpegPath)

const ffprobePath = FFPROBE_PATH || require('@ffprobe-installer/ffprobe').path
ffmpeg.setFfprobePath(ffprobePath)

const mergeFolder = randomNewTmpFileName('/')

async function ffmpegExtract (input, startSec, durationSec, ext = 'mp3') {
  return new Promise(async (resolve, reject) => {
    const output = randomNewTmpFileName(ext)

    ffmpeg(input)
      .setStartTime(startSec)
      .setDuration(durationSec)
      .output(output)
      .on('end', () => resolve(output))
      .on('error', err => {
        console.error(`ffmpeg error::  ${err}`)
        reject(err)
      })
      .run()
  })
}

function mergeMedias (files) {
  return new Promise((resolve, reject) => {
    let ffProcess = ffmpeg()

    files.forEach(f => {
      ffProcess = ffProcess.addInput(f)
    })

    const mergedFile = randomNewTmpFileName('mp3')

    ffProcess
      .mergeToFile(mergedFile, mergeFolder)
      .on('error', reject)
      .on('end', function () {
        resolve(mergedFile)
      })
  })
}

function normalizeRecommended (
  inputPath,
  outputPath = randomNewTmpFileName('mp3')
) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .withOutputOptions(
        '-af loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=-27.2:measured_TP=-14.4:measured_LRA=0.1:measured_thresh=-37.7:offset=-0.5:linear=true'
      )
      .output(outputPath)
      .on('error', reject)
      .on('end', function () {
        resolve(outputPath)
      })
      .run()
  })

  /*
  await normalize({
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
  return outputPath
*/
}

module.exports = {
  ffmpegExtract,
  mergeMedias,
  normalizeRecommended
}
