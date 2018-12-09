const {
  delOldRadioStreams,
  delOldZaps,
  getOldRadioStreams,
  getOldZaps
} = require('../../models')
const { deleteStorageFile } = require('../../utils')

async function removeOldRadioStreams () {
  try {
    const oldRadiosStreams = await getOldRadioStreams()
    await Promise.all(
      oldRadiosStreams.map(({ record_path }) => deleteStorageFile(record_path))
    )
    await delOldRadioStreams()

    console.log('clean records done')
  } catch (err) {
    console.error('Error when trying to remove old radio streams', err)
  }
}

async function removeOldZaps () {
  try {
    const oldZaps = await getOldZaps()
    await Promise.all(
      oldZaps.map(({ zap_path }) => deleteStorageFile(zap_path))
    )
    await delOldZaps()

    console.log('clean zaps done')
  } catch (err) {
    console.error('Error when trying to remove old radio streams', err)
  }
}

module.exports = async () => {
  await Promise.all([removeOldRadioStreams(), removeOldZaps()])
}
