import fs from "fs"
import path from "path"
import { CommandLineOptions } from "command-line-args"
import { Config, readConfig } from "./config"
import { fetchMedia } from "./watch"
import { OAuth2Client } from "google-auth-library"
import { promisify } from "util"

const unlink = promisify(fs.unlink)

const getPrunedItems = async (config: Config, options: CommandLineOptions) => {
  const mediaItems: any[] = await fetchMedia(config)
  const limit = new Date()
  limit.setDate(limit.getDate() - Number.parseInt(options["keep-days"]))
  console.log(`Deleting media items that were created before ${limit}`)
  return mediaItems.filter(item => {
    const created = new Date(item.mediaMetadata.creationTime)
    return created.valueOf() < limit.valueOf()
  })
}

/*
Google Photos doesn't provide functionality to delete images or videos but only remove them from the album and that's not working.

const deleteMedia = async (config: Config, mediaItems: any[]) => {
  const oauth2Client = new OAuth2Client()
  oauth2Client.setCredentials(config.tokens!)
  console.log(
    JSON.stringify({
      mediaItemIds: mediaItems.map(item => item.id)
    })
  )
  try {
    await oauth2Client.request<any>({
      method: "POST",
      url: `https://photoslibrary.googleapis.com/v1/albums/${config.albumId}:batchRemoveMediaItems`,
      body: JSON.stringify({
        mediaItemIds: mediaItems.map(item => item.id)
      })
    })
  } catch (error) {
    console.log(`Deleting the image failed`)
    console.log(error.message)
  }
}
*/

const deleteLocal = async (options: CommandLineOptions, mediaItems: any[]) => {
  const absPath = path.resolve(options.folder)
  console.log(`Deleting local files in path "${absPath}"`)

  const promises = mediaItems.map(async item => {
    try {
      await unlink(path.join(absPath, item.filename))
      console.log(`Deleted local file: ${item.filename}`)
    } catch (error) {
      console.log(`Unable to delete the local file: ${item.filename}`)
    }
  })
  return Promise.all(promises)
}

export const prune = async (options: CommandLineOptions) => {
  if (!options["keep-days"]) {
    console.log("--keep-days is mandatory option for prune command")
    return
  }

  if (Number.isNaN(Number.parseInt(options["keep-days"]))) {
    console.log("Invalid value for --keep-days")
    return
  }

  if (options["delete-local"] && !options.folder) {
    console.log("--folder must be defined when --delete-local is used")
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

  const prunedItems = await getPrunedItems(config, options)
  //  await deleteMedia(config, prunedItems)
  if (options["delete-local"]) {
    await deleteLocal(options, prunedItems)
  }
}

export const definition = {
  command: {
    name: "prune",
    description: "Deletes old images and videos from the album."
  },
  options: [
    {
      name: "keep-days",
      typeLabel: "{underline days}",
      description: "The number of days to keep the images and videos."
    },
    {
      name: "folder",
      alias: "f",
      typeLabel: "{underline path}",
      description: "The path of the folder where the local files are."
    },
    {
      name: "delete-local",
      type: Boolean,
      description: "Deletes also local files if they exists."
    }
  ],
  exec: prune
}
