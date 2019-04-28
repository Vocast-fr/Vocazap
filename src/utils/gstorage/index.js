require('dotenv').config()

const { Storage } = require('@google-cloud/storage')

const { GCLOUD_KEYFILENAME, GSTORAGE_BUCKET } = process.env

// Creates a client
const storage = new Storage({
  keyFilename: GCLOUD_KEYFILENAME
})

async function uploadLocalFileToStorage (filename, destination) {
  await storage
    .bucket(GSTORAGE_BUCKET)
    .upload(filename, { destination, resumable: false })
  const url = `https://storage.googleapis.com/${GSTORAGE_BUCKET}/${destination}`
  //  console.log(`File uploaded to bucket ${GSTORAGE_BUCKET}, available here : ${url}.`)
  return url
}

async function deleteStorageFile (filename) {
  await storage
    .bucket(GSTORAGE_BUCKET)
    .file(filename)
    .delete()

  // console.log(`gs://${GSTORAGE_BUCKET}/${filename} deleted.`)
}

async function downloadStorageFile (srcFilename, destination) {
  await storage
    .bucket(GSTORAGE_BUCKET)
    .file(srcFilename)
    .download({ destination })
}

async function getAllFilesContainingStr (strings) {
  let [allFiles] = await storage.bucket(GSTORAGE_BUCKET).getFiles()

  allFiles = allFiles
    .filter(({ name }) => {
      const fileToReturn = strings.some(s => new RegExp(s).test(name))
      // console.log({ name, strings, fileToReturn })
      return fileToReturn
    })
    .map(({ name }) => name)

  return allFiles
}

module.exports = {
  getAllFilesContainingStr,
  uploadLocalFileToStorage,
  deleteStorageFile,
  downloadStorageFile
}
