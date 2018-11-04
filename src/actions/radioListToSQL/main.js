const { jsonFromXmlFile } = require('../../utils/xml')
const { upsertRadios } = require('../../models/radios')

// http://fluxradios.blogspot.com/2017/07/vlc-france.html
const XML_FILE = './src/actions/radioListToSQL/streams.xml'

function getRadiosFromList () {
  return jsonFromXmlFile(XML_FILE).then(jsonResult => {
    return jsonResult.playlist.trackList[0].track
      .map(({ title: [name], location: [stream_url] }) => ({
        name: name.replace(/[`~#$%^*_|\'",<>\{\}\[\]\\\/]/gi, ''),
        stream_url
      }))
      .filter(
        ({ stream_url }) =>
          stream_url.startsWith('http://lasonotheque.org/') === false
      )
    // .slice(3, 6); */
  })
}

module.exports = async function main () {
  try {
    const radios = await getRadiosFromList().catch(e =>
      console.error(`Error getting radios from list`, e)
    )
    const { updated, inserted } = await upsertRadios(radios).catch(e =>
      console.error(`Error updating/inserting radios from list`, e)
    )
    return {
      radios,
      inserted,
      updated
    }
  } catch (e) {
    console.error(`Main error`, e)
    return { e }
  }
}
