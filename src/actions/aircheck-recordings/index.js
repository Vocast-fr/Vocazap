const { getAllRadios, recordRadioStream } = require('../utils')

function recordHour (date) {
  getAllRadios()
    .then(allRadios => {
      return Promise.all(
        allRadios.map(radio => {
          const { stream_url: streamUrl, name: radioName } = radio

          return recordRadioStream(streamUrl, radioName, 60)
            .then(() => console.log(`done ${radioName}`))
            .catch(e => {
              console.error(`Error for radio ${radioName}`, e)
            })
        })
      )
    })
    .catch(e => {
      console.error('Erreur getting radio params', e)
    })
}

function main () {
  // cron toutes les heures
  recordHour()
}

main()
