const {
  deleteStorageFile,
  getAllFilesContainingStr
} = require('./src/utils/gstorage')

getAllFilesContainingStr(['19-03-31', '19-03-30'])
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
