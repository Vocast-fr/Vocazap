const fs = require('fs-extra')
const xml2js = require('xml2js')

function jsonFromXmlFile (file) {
  return new Promise((resolve, reject) => {
    var parser = new xml2js.Parser()

    fs.readFile(file, function (err, data) {
      if (err) {
        console.error(`Cannot read file ${file}`)
        reject(err)
      } else {
        parser.parseString(data, function (e, result) {
          if (e) {
            console.error(`Cannot parse file ${file}`)
            reject(e)
          } else {
            resolve(result)
          }
        })
      }
    })
  })
}
module.exports = {
  jsonFromXmlFile
}
