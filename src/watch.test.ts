const mockRequest = jest.fn()
const mockReaddirp = jest.fn()

function MockOAuth2Client() {
  return {
    request: mockRequest,
    setCredentials: jest.fn()
  }
}

jest.mock("google-auth-library", () => ({
  OAuth2Client: MockOAuth2Client
}))

jest.mock("readdirp", () => ({
  promise: mockReaddirp
}))

import * as watch from "./watch"

describe("fetchMedia", () => {
  it("Runs as long as there is nextPageToken", async () => {
    mockRequest.mockImplementation(async options => {
      const body = JSON.parse(options.body)
      if (body.pageToken === 10) {
        return {
          data: { mediaItems: ["end"] }
        }
      } else {
        const nextPageToken = body.pageToken ? body.pageToken + 1 : 1
        return {
          data: { mediaItems: [nextPageToken], nextPageToken }
        }
      }
    })

    expect(await watch.fetchMedia({})).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, "end"])

    mockRequest.mockReset()
  })

  it("Returns empty array if request fails", async () => {
    mockRequest.mockImplementation(async () => {
      throw { message: "ERROR" }
    })

    expect(await watch.fetchMedia({})).toEqual([])

    mockRequest.mockReset()
  })
})

describe("sync", () => {
  it("Uploads new files to the server", async () => {
    mockReaddirp.mockImplementationOnce(async () => ["Foobar", "Barfoo"])
    const mockFetchMedia = jest.spyOn(watch, "fetchMedia").mockImplementationOnce(async () => [])
    const mockUploadMedia = jest.spyOn(watch, "uploadMedia").mockImplementationOnce(async () => true)
    await watch.sync({}, "", {})
    expect(mockReaddirp).toBeCalledTimes(1)
    expect(mockFetchMedia).toBeCalledTimes(1)
    expect(mockUploadMedia).toBeCalledTimes(1)

    mockReaddirp.mockReset()
    mockFetchMedia.mockReset()
    mockUploadMedia.mockReset()
  })

  it("Deletes files after successful upload", () => {})
  it("Doesn't delete files if upload fails", () => {})
  it("Doesn't fetch media if --delete-after-upload flag is set", () => {})

  it("Doesn't try to upload anything if there are no files", async () => {
    mockReaddirp.mockImplementationOnce(async () => [])
    const mockFetchMedia = jest.spyOn(watch, "fetchMedia").mockImplementationOnce(async () => [])
    const mockUploadMedia = jest.spyOn(watch, "uploadMedia").mockImplementationOnce(async () => true)
    await watch.sync({}, "", {})
    expect(mockReaddirp).toBeCalledTimes(1)
    expect(mockFetchMedia).toBeCalledTimes(1)
    expect(mockUploadMedia).toBeCalledTimes(0)

    mockReaddirp.mockReset()
    mockFetchMedia.mockReset()
    mockUploadMedia.mockReset()
  })

  it("Doesn't try to upload anything if there are no new files", async () => {
    mockReaddirp.mockImplementationOnce(async () => [{ basename: "Foobar" }, { basename: "Barfoo" }])
    const mockFetchMedia = jest
      .spyOn(watch, "fetchMedia")
      .mockImplementationOnce(async () => [{ filename: "Foobar" }, { filename: "Barfoo" }, { filename: "Extra" }])
    const mockUploadMedia = jest.spyOn(watch, "uploadMedia").mockImplementationOnce(async () => true)
    await watch.sync({}, "", {})
    expect(mockReaddirp).toBeCalledTimes(1)
    expect(mockFetchMedia).toBeCalledTimes(1)
    expect(mockUploadMedia).toBeCalledTimes(0)

    mockReaddirp.mockReset()
    mockFetchMedia.mockReset()
    mockUploadMedia.mockReset()
  })

  it("Runs sync again if called while it is being executed", () => {})
})
