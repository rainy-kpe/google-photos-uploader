import fs from "fs"
import path from "path"
import { debounce } from "debounce"
import { CommandLineOptions } from "command-line-args"
import { OAuth2Client } from "google-auth-library"
import { Config, readConfig } from "./config"
import { promisify } from "util"
import memoizee from "memoizee"

const readDir = promisify(fs.readdir)
const unlink = promisify(fs.unlink)

export const fetchMedia = async (config: Config) => {
  const oauth2Client = new OAuth2Client()
  oauth2Client.setCredentials(config.tokens!)

  let media: any[] = []
  let nextPageToken
  let response
  try {
    console.log(`Reading images from album ${config.albumName}...`)
    do {
      response = await oauth2Client.request<any>({
        method: "POST",
        url: "https://photoslibrary.googleapis.com/v1/mediaItems:search",
        body: JSON.stringify({
          albumId: config.albumId,
          pageSize: 100,
          pageToken: nextPageToken
        })
      })
      media = media.concat(response.data.mediaItems)
      nextPageToken = response.data.nextPageToken
    } while (nextPageToken)
    console.log(`Found ${media.length} images.`)
  } catch (error) {
    console.log("Unable to get the media item list.")
    console.log(error.message)
  }
  return media
}

const memoizedFetchMedia = memoizee(fetchMedia, {
  promise: true,
  maxAge: 60 * 60 * 1000
})

const uploadMedia = async (config: Config, files: string[], absPath: string) => {
  const oauth2Client = new OAuth2Client()
  oauth2Client.setCredentials(config.tokens!)

  const tokens = []
  for (const file of files) {
    console.log(`Uploading ${file}`)
    try {
      const response = await oauth2Client.request<any>({
        method: "POST",
        url: "https://photoslibrary.googleapis.com/v1/uploads",
        headers: {
          "Content-type": "application/octet-stream",
          "X-Goog-Upload-File-Name": file,
          "X-Goog-Upload-Protocol": "raw"
        },
        body: fs.createReadStream(path.join(absPath, file))
      })
      tokens.push(response.data)
    } catch (error) {
      console.log(`Uploading the file failed`)
      console.log(error.message)
    }
  }

  if (tokens.length > 0) {
    console.log(`Adding uploaded images to the album...`)

    try {
      await oauth2Client.request<any>({
        method: "POST",
        url: "https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate",
        body: JSON.stringify({
          albumId: config.albumId,
          newMediaItems: tokens.map(token => ({
            description: `Uploaded by google-photos-uploader on ${Date.now()}`,
            simpleMediaItem: { uploadToken: token }
          })),
          albumPosition: {
            position: "FIRST_IN_ALBUM"
          }
        })
      })

      memoizedFetchMedia.clear()
      return true
    } catch (error) {
      console.log(`Unable to create the images to the album.`)
      console.log(error.message)
    }
  } else {
    console.log(`There were no successfully uploaded files`)
  }
  return false
}

const deleteFiles = async (newFiles: string[], absPath: string) => {
  try {
    const promises = newFiles.map(file => {
      console.log(`Deleting ${file}`)
      return unlink(path.join(absPath, file))
    })
    await Promise.all(promises)
  } catch (error) {
    console.log(`Unable to delete the files.`)
    console.log(error.message)
  }
}

// Sync:
// - Get media from the album (maybe not always...)
// - Upload new image and video files (+ add them to the cached media list)
// - If delete flag is set delete the files after upload
const sync = async (config: Config, absPath: string, options: CommandLineOptions) => {
  console.log(`Uploading local files to the online album: ${config.albumName}`)
  const mediaItems = await memoizedFetchMedia(config)
  const localFiles = await readDir(absPath)

  // Compare the local files and what's on online
  const newFiles = localFiles.filter(file => !mediaItems.find(item => item.filename === file))
  if (newFiles.length > 0) {
    console.log(`New files found: ${newFiles}`)
    const success = await uploadMedia(config, newFiles, absPath)
    if (success && options.delete) {
      await deleteFiles(newFiles, absPath)
    }
  } else {
    console.log("No new files found")
  }
  console.log("Uploading finished")
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

  const debouncedSync = debounce(sync, 1000)
  await debouncedSync(config, absPath, options)

  fs.watch(absPath, () => {
    debouncedSync(config, absPath, options)
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
      name: "delete",
      alias: "d",
      type: Boolean,
      description: "Delete file after successful upload."
    }
  ],
  exec: watch
}
