const { search, deleteFileById } = require('./src/utils/drive')

async function main() {
  let dayN = 1

  while (dayN < 32) {
    const dayString = dayN < 10 ? `0${dayN}` : dayN
    const q = `trashed=false and name='22-07-${dayString}' and mimeType='application/vnd.google-apps.folder'`

    const files = await search(q)
    // console.log(files)

    for (const { id, name } of files) {
      await deleteFileById(id)
      console.log('deleted ', id, name)
    }
    dayN++
  }
}

main()
  .then(() => console.log('OK'))
  .catch(console.error)
