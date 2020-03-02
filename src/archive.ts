import path from "path"
import { OAuth2Client } from "google-auth-library"
import { CommandLineOptions } from "command-line-args"
import { readConfig, Config } from "./config"
import { getAlbums, createAlbum, fetchMedia, deleteFiles } from "./common"

export const addToAlbum = async (config: Config, albumId: string, ids: string[]) => {
  const oauth2Client = new OAuth2Client(config.clientId, config.clientSecret, "urn:ietf:wg:oauth:2.0:oob")
  oauth2Client.setCredentials(config.tokens!)

  console.log(`Adding ${ids.length} media items to the album`)
  const chunk = 10
  for (let i = 0, j = ids.length; i < j; i += chunk) {
    const idsChunk = ids.slice(i, i + chunk)

    try {
      await oauth2Client.request<any>({
        method: "POST",
        url: `https://photoslibrary.googleapis.com/v1/albums/${albumId}:batchAddMediaItems`,
        body: JSON.stringify({
          mediaItemIds: idsChunk
        })
      })
    } catch (error) {
      console.error(`Unable to add the media to the album.`)
      console.error(error.message)
      return false
    }
  }
  return true
}

export const removeFromAlbum = async (config: Config, albumId: string, ids: string[]) => {
  const oauth2Client = new OAuth2Client(config.clientId, config.clientSecret, "urn:ietf:wg:oauth:2.0:oob")
  oauth2Client.setCredentials(config.tokens!)

  console.log(`Removing ${ids.length} media items from the album`)
  const chunk = 10
  for (let i = 0, j = ids.length; i < j; i += chunk) {
    const idsChunk = ids.slice(i, i + chunk)

    try {
      await oauth2Client.request<any>({
        method: "POST",
        url: `https://photoslibrary.googleapis.com/v1/albums/${albumId}:batchRemoveMediaItems`,
        body: JSON.stringify({
          mediaItemIds: idsChunk
        })
      })
    } catch (error) {
      console.error(`Unable to remove the media to the album.`)
      console.error(error.message)
      return false
    }
  }
  return true
}

// Check if the archive album exists
// Create the album if it doesn't
// Get all media files before the date
// Remove media files from original album
// Add media files to archive album
export const archive = async (options: CommandLineOptions) => {
  if (!options["keep-days"]) {
    console.log("--keep-days is mandatory option for archive command")
    return
  }

  const config = await readConfig(true)
  if (!config.tokens) {
    console.log("The authentication token is missing. Run 'config' command first.")
    return
  }
  if (!config.albumId) {
    console.log("The original album is not defined. Run 'config' command first.")
    return
  }

  const albums = await getAlbums(config)
  const originalAlbum = albums.find(album => album.id === config.albumId)
  if (!originalAlbum) {
    console.log("The original album cannot be found. Run 'config' command first.")
    return
  }
  const archiveName = `${originalAlbum.title} (Archive)`
  let archiveAlbum = albums.find(album => album.title === archiveName)
  if (!archiveAlbum) {
    console.log(`The archive album (${archiveName}) doesn't exists. Creating it.`)
    archiveAlbum = await createAlbum(config, archiveName)
  } else {
    console.log(`Found the archive album: ${archiveName}`)
  }

  const endDate = new Date()
  endDate.setDate(new Date().getDate() - options["keep-days"])
  console.log(`Archiving all media before ${endDate}`)
  const archivedMedia = await (await fetchMedia(config)).filter(
    media => new Date(media.mediaMetadata.creationTime) < endDate
  )

  if (archivedMedia.length === 0) {
    console.log("No media found before the archive date")
  } else {
    console.log(`Found ${archivedMedia.length} to be archived`)
  }

  const removeOk = await removeFromAlbum(
    config,
    originalAlbum.id,
    archivedMedia.map(media => media.id)
  )
  if (removeOk) {
    const addOk = await addToAlbum(
      config,
      archiveAlbum.id,
      archivedMedia.map(media => media.id)
    )
    if (addOk && options.folder) {
      const absPath = path.resolve(options.folder)
      console.log(`Removing archived media files from the local path: ${absPath}`)
      await deleteFiles(
        archivedMedia.map(media => path.join(absPath, media.filename)),
        true
      )
    }
  }
}

export const definition = {
  command: {
    name: "archive",
    description: "Move old photos to archive album."
  },
  options: [
    {
      name: "folder",
      alias: "f",
      typeLabel: "{underline path}",
      description: "The path of the watched folder."
    },
    {
      name: "keep-days",
      type: Number,
      description: "Number of days to keep in the original album."
    }
  ],
  exec: archive
}
