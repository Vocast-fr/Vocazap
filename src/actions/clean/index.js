const {
  deleteSpecificStreamRecord,
  deleteSpecificZap,
  getOldRadioStreams,
  getOldZaps
} = require('../../models')
const { deleteStorageFile } = require('../../utils')

async function removeOldRadioStreams () {
  try {
    const oldRadiosStreams = await getOldRadioStreams()

    for (let { id, record_path } of oldRadiosStreams) {
      try {
        await deleteStorageFile(record_path)
        await deleteSpecificStreamRecord(id)
      } catch (e) {
        console.error(`Cannot delete stream record ${record_path}`, e)
      }
    }

    console.log('clean records done')
  } catch (err) {
    console.error('Error when trying to remove old radio streams', err)
  }
}

async function removeOldZaps () {
  try {
    const oldZaps = await getOldZaps()

    for (let { id, zap_path } of oldZaps) {
      try {
        await deleteStorageFile(zap_path)
        await deleteSpecificZap(id)
      } catch (e) {
        console.error(`Cannot delete zap ${zap_path}`, e)
      }
    }

    console.log('clean zaps done')
  } catch (err) {
    console.error('Error when trying to remove old radio streams', err)
  }
}

module.exports = async () => {
  await Promise.all([removeOldRadioStreams(), removeOldZaps()])
}
