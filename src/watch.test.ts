const mockRequest = jest.fn()
const mockReaddirp = jest.fn()
let mockFetchMedia: any
let mockUploadMedia: any
let mockDeleteFiles: any

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
  beforeEach(() => {
    mockReaddirp.mockImplementationOnce(async () => [])
    mockFetchMedia = jest.spyOn(watch, "fetchMedia").mockImplementationOnce(async () => [])
    mockUploadMedia = jest.spyOn(watch, "uploadMedia").mockImplementationOnce(async () => true)
    mockDeleteFiles = jest.spyOn(watch, "deleteFiles").mockImplementationOnce(async () => {})
  })

  afterEach(() => {
    mockReaddirp.mockReset()
    mockFetchMedia.mockReset()
    mockUploadMedia.mockReset()
    mockDeleteFiles.mockReset()
  })

  it("Uploads new files to the server", async () => {
    mockReaddirp.mockReset()
    mockReaddirp.mockImplementationOnce(async () => ["Foobar", "Barfoo"])
    await watch.sync({}, "", {})
    expect(mockReaddirp).toBeCalledTimes(1)
    expect(mockFetchMedia).toBeCalledTimes(1)
    expect(mockUploadMedia).toBeCalledTimes(1)
  })

  it("Deletes files after successful upload", async () => {
    mockReaddirp.mockReset()
    mockReaddirp.mockImplementationOnce(async () => ["Foobar", "Barfoo"])
    await watch.sync({}, "", { "delete-after-upload": true })
    expect(mockReaddirp).toBeCalledTimes(1)
    expect(mockFetchMedia).toBeCalledTimes(0)
    expect(mockUploadMedia).toBeCalledTimes(1)
    expect(mockDeleteFiles).toBeCalledTimes(1)
    expect(mockDeleteFiles).toBeCalledWith(["Foobar", "Barfoo"])
  })

  it("Doesn't delete files if upload fails", async () => {
    mockReaddirp.mockReset()
    mockReaddirp.mockImplementationOnce(async () => ["Foobar", "Barfoo"])
    mockUploadMedia.mockReset()
    mockUploadMedia.mockImplementationOnce(async () => false)
    await watch.sync({}, "", { "delete-after-upload": true })
    expect(mockDeleteFiles).toBeCalledTimes(0)
  })

  it("Doesn't fetch media if --delete-after-upload flag is set", async () => {
    mockReaddirp.mockReset()
    mockReaddirp.mockImplementationOnce(async () => ["Foobar", "Barfoo"])
    await watch.sync({}, "", { "delete-after-upload": true })
    expect(mockFetchMedia).toBeCalledTimes(0)
  })

  it("Doesn't try to upload anything if there are no files", async () => {
    await watch.sync({}, "", {})
    expect(mockReaddirp).toBeCalledTimes(1)
    expect(mockFetchMedia).toBeCalledTimes(1)
    expect(mockUploadMedia).toBeCalledTimes(0)
  })

  it("Doesn't try to upload anything if there are no new files", async () => {
    mockReaddirp.mockReset()
    mockReaddirp.mockImplementationOnce(async () => [{ basename: "Foobar" }, { basename: "Barfoo" }])
    mockFetchMedia.mockReset()
    mockFetchMedia.mockImplementationOnce(async () => [
      { filename: "Foobar" },
      { filename: "Barfoo" },
      { filename: "Extra" }
    ])
    await watch.sync({}, "", {})
    expect(mockReaddirp).toBeCalledTimes(1)
    expect(mockFetchMedia).toBeCalledTimes(1)
    expect(mockUploadMedia).toBeCalledTimes(0)
  })

  it("Runs sync again if called while it is being executed", async () => {
    mockReaddirp.mockReset()
    mockReaddirp.mockImplementation(async () => [{ basename: "Foobar" }, { basename: "Barfoo" }])
    mockFetchMedia.mockReset()
    mockFetchMedia = jest.spyOn(watch, "fetchMedia").mockImplementation(
      () =>
        new Promise(resolve => {
          setTimeout(() => resolve([]), 100)
        })
    )

    const promise = watch.sync({}, "", {})
    await watch.sync({}, "", {})
    // The second sync() returns immediately so the first sync() is still running but hasn't had time to upload anything yet
    expect(mockReaddirp).toBeCalledTimes(1)
    expect(mockFetchMedia).toBeCalledTimes(1)
    expect(mockUploadMedia).toBeCalledTimes(0)
    await promise
    // After the first sync is done it will call sync() again
    expect(mockReaddirp).toBeCalledTimes(2)
    expect(mockFetchMedia).toBeCalledTimes(2)
    expect(mockUploadMedia).toBeCalledTimes(2)
  })
})
