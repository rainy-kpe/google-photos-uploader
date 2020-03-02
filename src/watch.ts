import fs from "fs"
import nodeWatch from "node-watch"
import path from "path"
import { debounce } from "debounce"
import { CommandLineOptions } from "command-line-args"
import { OAuth2Client } from "google-auth-library"
import { Config, readConfig } from "./config"
import readdirp, { EntryInfo } from "readdirp"
import { fetchMedia, deleteFiles } from "./common"

export const uploadMedia = async (config: Config, files: EntryInfo[], deleteAfterUpload: boolean) => {
  const oauth2Client = new OAuth2Client(config.clientId, config.clientSecret, "urn:ietf:wg:oauth:2.0:oob")
  oauth2Client.setCredentials(config.tokens!)

  files.sort((a, b) => b.basename.localeCompare(a.basename))

  files = files.filter(file => {
    const stats = fs.statSync(file.fullPath)
    return stats["size"] !== 0
  })

  const chunk = 1
  for (let i = 0, j = files.length; i < j; i += chunk) {
    const filesChunk = files.slice(i, i + chunk)

    // Upload the media files to the server
    const tokens = []
    for (const file of filesChunk) {
      console.log(`Uploading ${file.path}`)
      try {
        const response = await oauth2Client.request<any>({
          method: "POST",
          url: "https://photoslibrary.googleapis.com/v1/uploads",
          headers: {
            "Content-type": "application/octet-stream",
            "X-Goog-Upload-File-Name": file.basename,
            "X-Goog-Upload-Protocol": "raw"
          },
          body: fs.createReadStream(file.fullPath)
        })
        tokens.push(response.data)
      } catch (error) {
        console.warn(`Uploading the file failed`)
        console.error(error)
      }
    }

    // Connect the media files to album
    if (tokens.length > 0) {
      console.log(`Adding uploaded media to the album...`)

      try {
        await oauth2Client.request<any>({
          method: "POST",
          url: "https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate",
          body: JSON.stringify({
            albumId: config.albumId,
            newMediaItems: tokens.map(token => ({
              description: `Uploaded by google-photos-uploader on ${new Date()}`,
              simpleMediaItem: { uploadToken: token }
            })),
            albumPosition: {
              position: "FIRST_IN_ALBUM"
            }
          })
        })

        if (deleteAfterUpload) {
          await deleteFiles(filesChunk.map(file => file.fullPath))
        }

      } catch (error) {
        console.warn(`Unable to create the media to the album.`)
        console.error(error.message)
      }

    } else {
      console.log(`There were no successfully uploaded files`)
    }
  }

  return files.length > 0
}

let syncOngoing = false
let runSyncAgain = false

// Sync:
// - Get media from the album (maybe not always...)
// - Upload new image and video files (+ add them to the cached media list)
// - If delete flag is set delete the files after upload
export const sync = async (config: Config, absPath: string, options: CommandLineOptions, changedFiles: Set<string>) => {
  console.log(`Sync triggered by the following files: ${Array.from(changedFiles).map(file => path.basename(file))}`)
  changedFiles.clear()

  if (syncOngoing) {
    console.log("Sync is already running.")
    runSyncAgain = true
    return
  }
  syncOngoing = true

  console.log(`Uploading local files to the online album: ${config.albumName}`)

  let mediaItems: any[] = []
  const localFiles = await readdirp.promise(absPath)
  // If --delete-after-upload is set there is no need to compare with the online content. We just upload everything that's in the folder.
  if (!options["delete-after-upload"]) {
    mediaItems = await fetchMedia(config)
  }

  // Compare the local files and what's on online
  const newFiles = localFiles.filter(file => !mediaItems.find(item => item && item.filename === file.basename))
  if (newFiles.length > 0) {
    console.log(`New files found: ${newFiles.length}`)
    await uploadMedia(config, newFiles, options["delete-after-upload"])
  } else {
    console.log("No new files found")
  }
  syncOngoing = false
  console.log("Uploading finished")

  if (runSyncAgain) {
    runSyncAgain = false
    await sync(config, absPath, options, new Set())
  }
}

export const watch = async (options: CommandLineOptions) => {
  if (!options.folder) {
    console.log("--folder is mandatory option for watch command")
    return
  }

  const config = await readConfig(true)
  if (!config.tokens) {
    console.log("The authentication token is missing. Run 'config' command first.")
    return
  }
  if (!config.albumId) {
    console.log("The target album is not defined. Run 'config' command first.")
    return
  }

  const absPath = path.resolve(options.folder)
  console.log(`Watching ${absPath} for changes`)

  const debouncedSync = debounce(sync, 3000)
  await debouncedSync(config, absPath, options, new Set())

  const changedFiles = new Set<string>()
  nodeWatch(absPath, { recursive: true }, async (eventType: string, filename: string) => {
    changedFiles.add(filename)
    debouncedSync(config, absPath, options, changedFiles)
  })
}

export const definition = {
  command: {
    name: "watch",
    description: "Starts watching the folder for new images and videos."
  },
  options: [
    {
      name: "folder",
      alias: "f",
      typeLabel: "{underline path}",
      description: "The path of the watched folder."
    },
    {
      name: "delete-after-upload",
      type: Boolean,
      description: "Delete file after successful upload."
    }
  ],
  exec: watch
}
