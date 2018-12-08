const { delOldRadioStreams, getOldRadioStreams } = require('../../models')
const { deleteStorageFile } = require('../../utils')

async function removeOldRadioStreams () {
  try {
    const oldRadiosStreams = await getOldRadioStreams()

    await Promise.all(
      oldRadiosStreams.map(({ record_path }) => deleteStorageFile(record_path))
    )

    await delOldRadioStreams()

    console.log('clean done')
  } catch (err) {
    console.error('Error when trying to remove old radio streams', err)
  }
}

module.exports = async () => {
  await removeOldRadioStreams()
}
