const {
  deleteStorageFile,
  getAllFilesContainingStr
} = require('./src/utils/gstorage')

getAllFilesContainingStr([
  '19-02-13',
  '19-03-26',
  '19-03-27',
  '19-03-28',
  '19-03-29',
  '19-03-31',
  '19-03-30'
])
  .then(async allFileNamesToDelete => {
    console.log(`${allFileNamesToDelete.length} to delete`)

    let cpt = 0

    for (let filename of allFileNamesToDelete) {
      try {
        await deleteStorageFile(filename)
        cpt++
      } catch (e) {
        console.error(`Cannot delete ${filename}`, e)
      }
    }

    console.log(`${cpt} files deleted`)
  })
  .catch(console.error)
