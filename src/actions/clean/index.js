const AmazonS3URI = require('amazon-s3-uri')
const { delOldRadioStreams, getOldRadioStreams } = require('../../models')
const { deleteFilesFromS3 } = require('../../utils')

async function removeOldRadioStreams () {
  try {
    const oldRadiosStreams = await getOldRadioStreams()

    const allObjectsKeys = oldRadiosStreams
      .map(({ record_url }) => AmazonS3URI(record_url).key)
      .filter(k => !!k)

    if (allObjectsKeys.length) {
      await deleteFilesFromS3(allObjectsKeys)
      await delOldRadioStreams()
    }
    // console.log('clean ok')
  } catch (err) {
    console.error('Error when trying to remove old radio streams', err)
  }
}

module.exports = async () => {
  await removeOldRadioStreams()
}
