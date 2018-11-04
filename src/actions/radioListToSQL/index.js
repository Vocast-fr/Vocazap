const main = require('./main.js')

main()
  .then(({ radios }) => {
    console.log(
      `Radio listing update done (found ${radios.length} items in playlist)`
    )
    process.exit(0)
  })
  .catch(e => console.error(`MAIN ERROR`, e))
