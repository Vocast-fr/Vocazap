require('dotenv').config()

const { DRIVE_TOKEN_PATH, DRIVE_CREDENTIALS } = process.env

const fs = require('fs-extra')
const readline = require('readline-sync')

const { google } = require('googleapis')
// https://developers.google.com/drive/api/v3/quickstart/nodejs
// https://developers.google.com/drive/api/v3/search-files

// If modifying these scopes, delete DRIVE_TOKEN_PATH file
const SCOPES = ['https://www.googleapis.com/auth/drive']
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
async function getAccessToken (oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  })
  console.log('Authorize this app by visiting this url:', authUrl)

  const code = readline.question('Enter the code from that page here: ')

  const token = await oAuth2Client.getToken(code)

  // Store the token to disk for later program executions
  fs.writeFileSync(DRIVE_TOKEN_PATH, JSON.stringify(token))
  console.log('Token stored to', DRIVE_TOKEN_PATH)

  return token
}

async function getDriveSetUp () {
  // Load client secrets from a local file.
  const credentials = JSON.parse(fs.readFileSync(DRIVE_CREDENTIALS))

  const { client_secret, client_id, redirect_uris } = credentials.installed
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  )

  // Check if we have previously stored a token.
  let token
  try {
    token = JSON.parse(fs.readFileSync(DRIVE_TOKEN_PATH))
  } catch (e) {
    token = await getAccessToken(oAuth2Client)
  }

  oAuth2Client.setCredentials(token.tokens)

  return google.drive({ version: 'v3', auth: oAuth2Client })
}

/**
 * Lists the names and IDs of up to 10 files.
 */
async function listFiles () {
  const drive = await getDriveSetUp()
  const {
    data: { files }
  } = await drive.files.list({
    pageSize: 10,
    fields: 'nextPageToken, files(id, name)'
  })

  if (files.length) {
    console.log('Files:')
    files.map(file => {
      console.log(`${file.name} (${file.id})`)
    })
  } else {
    console.log('No files found.')
  }
}

async function search (q) {
  const drive = await getDriveSetUp()

  const {
    data: { files }
  } = await drive.files.list({
    q,
    spaces: 'drive',
    pageToken: null,
    fields: 'nextPageToken, files(id, name)'
  })

  return files
}

async function createFolder (name, parentFolderId) {
  const drive = await getDriveSetUp()
  const resource = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentFolderId]
  }
  const folder = await drive.files.create({
    resource,
    fields: 'id'
  })
  const folderId = folder.data.id
  return folderId
}

/**
 * filetype : 'audio/mpeg'
 */
async function uploadFile (
  name,
  sourcePath,
  mimeType,
  permission = {
    type: 'anyone',
    role: 'reader'
  },
  folderId
) {
  const drive = await getDriveSetUp()

  const resource = {
    name
  }
  if (folderId) resource.parents = [folderId]

  const media = {
    mimeType,
    body: fs.createReadStream(sourcePath)
  }

  const file = await drive.files.create({
    resource,
    media,
    fields: 'id'
  })

  const fileId = file.data.id

  await drive.permissions.create({
    resource: permission,
    fileId,
    fields: 'id'
  })

  const ddlUrl = `https://drive.google.com/open?id=${fileId}`
  return ddlUrl
}

async function uploadFileAccordingPath (
  folderPath,
  fileName,
  sourcePath,
  mimeType,
  permission = {
    type: 'anyone',
    role: 'reader'
  }
) {
  const folders = folderPath.split('/')

  let folderId

  for (let folder of folders) {
    let q = folderId ? `'${folderId}' in parents and ` : ''
    q +=
      `trashed=false and name contains '${folder}' ` +
      `and mimeType='application/vnd.google-apps.folder'`

    const files = await search(q)

    if (!files || !files[0] || !files[0].id) {
      folderId = await createFolder(folder, folderId)
    } else {
      folderId = files[0].id
    }
  }

  const fileUrl = await uploadFile(
    fileName,
    sourcePath,
    mimeType,
    permission,
    folderId
  )

  return fileUrl
}

module.exports = {
  getDriveSetUp,
  search,
  listFiles,
  createFolder,
  uploadFile,
  uploadFileAccordingPath
}
