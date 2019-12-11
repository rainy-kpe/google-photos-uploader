import { CommandLineOptions } from "command-line-args"
import { Config, readConfig } from "./config"
import { fetchMedia } from "./watch"
import { OAuth2Client } from "google-auth-library"

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

const deleteMedia = async (config: Config, mediaItems: any[]) => {
  const oauth2Client = new OAuth2Client(config.clientId, config.clientSecret, "urn:ietf:wg:oauth:2.0:oob")
  oauth2Client.setCredentials(config.tokens!)
  const tokenResponse = await oauth2Client.refreshAccessToken()

  console.log(`Uploading ${files}`)

  const photos = new GooglePhotos(tokenResponse.credentials.access_token)
  try {
    await photos.mediaItems.uploadMultiple(
      config.albumId,
      files.map(file => ({ name: file })),
      absPath
    )
    memoizedFetchMedia.clear()
    return true
  } catch (error) {
    console.log(`Unable to upload the files.`)
    console.log(error.message)
  }
  return false
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
  }

  const prunedItems = await getPrunedItems(config, options)
  await deleteMedia(config, prunedItems)
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
