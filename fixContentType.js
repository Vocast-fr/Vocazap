const req = require('superagent')
const { getAllActivatedRadios, upsertRadios } = require('./src/models')
const { sleep } = require('./src/utils')

const radiosToUpdate = []

getAllActivatedRadios()
  .then(radios =>
    Promise.all(
      radios.map(async radio => {
        const { name, stream_url } = radio
        try {
          let stream_content_type
          const reqPromise = req.get(stream_url)

          reqPromise
            .then(ended => {
              stream_content_type = ended.res.headers['content-type']
            })
            .catch(failed => console.log({ failed, stream_url }))

          await sleep(30000)
          reqPromise.abort()
          await sleep(30000)

          if (!stream_content_type) {
            console.log('No content type for ', {
              stream_url,
              stream_content_type
            })
          } else if (stream_content_type.includes('audio/mpeg') === false) {
            radio.stream_content_type = stream_content_type
            radiosToUpdate.push(radio)
          }
        } catch (e) {
          console.error(`Process for radio ${name} failed `, e)
        }
      })
    )
  )
  .then(() => upsertRadios(radiosToUpdate))
  .then(() => console.log('DONE'))
  .catch(console.error)
