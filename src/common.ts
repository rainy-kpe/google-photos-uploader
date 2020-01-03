import { OAuth2Client } from "google-auth-library"
import { Config } from "./config"

export const appName = "Google Photos Uploader"

export const getAlbums = async (config: Config) => {
  const oauth2Client = new OAuth2Client(config.clientId, config.clientSecret, "urn:ietf:wg:oauth:2.0:oob")
  oauth2Client.setCredentials(config.tokens!)

  let albums: any[] = []
  let nextPageToken
  let response
  try {
    console.log("Reading albums...")
    do {
      response = await oauth2Client.request<any>({
        url: "https://photoslibrary.googleapis.com/v1/albums",
        params: {
          pageSize: 50,
          pageToken: nextPageToken
        }
      })
      albums = albums.concat(response.data.albums)
      nextPageToken = response.data.nextPageToken
    } while (nextPageToken)
  } catch (error) {
    console.log("Unable to get the album list.")
    console.log(error.message)
  }
  return albums
}

export const createAlbum = async (config: Config, albumName: string) => {
  const oauth2Client = new OAuth2Client(config.clientId, config.clientSecret, "urn:ietf:wg:oauth:2.0:oob")
  oauth2Client.setCredentials(config.tokens!)

  try {
    console.log(`Creating new album: ${albumName}`)

    const response = await oauth2Client.request<any>({
      method: "POST",
      url: "https://photoslibrary.googleapis.com/v1/albums",
      body: JSON.stringify({
        album: {
          title: albumName
        }
      })
    })
    return response.data
  } catch (error) {
    console.log("Unable to get the album list.")
    console.log(error.message)
    return undefined
  }
}

export const fetchMedia = async (config: Config) => {
  const oauth2Client = new OAuth2Client(config.clientId, config.clientSecret, "urn:ietf:wg:oauth:2.0:oob")
  oauth2Client.setCredentials(config.tokens!)

  let media: any[] = []
  let nextPageToken
  let response
  try {
    console.log(`Reading media from album ${config.albumName}...`)
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
    console.log(`Found ${media.length} media files.`)
  } catch (error) {
    console.warn("Unable to get the media item list.")
    console.error(error.message)
  }
  return media
}
