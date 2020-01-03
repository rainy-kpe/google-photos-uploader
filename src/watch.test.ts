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

import fs from "fs"
import * as watch from "./watch"
import * as common from "./common"

describe("uploadMedia", () => {
  beforeEach(() => {
    mockRequest.mockImplementationOnce(async () => [])
    jest.spyOn(fs, "createReadStream").mockImplementation(() => ({} as any))
  })

  afterEach(() => {
    mockRequest.mockReset()
  })

  it("Uploads all chunks", async () => {
    mockRequest.mockImplementation(async () => ({
      data: "foo"
    }))
    await watch.uploadMedia(
      {},
      new Array(100).fill(0).map((_, i) => ({ path: "", basename: `${i}`, fullPath: `${i}` }))
    )
    expect(mockRequest).toBeCalledTimes(100 + 10)
  })
})

describe("sync", () => {
  beforeEach(() => {
    mockReaddirp.mockImplementationOnce(async () => [])
    mockFetchMedia = jest.spyOn(common, "fetchMedia").mockImplementationOnce(async () => [])
    mockUploadMedia = jest.spyOn(watch, "uploadMedia").mockImplementationOnce(async () => true)
    mockDeleteFiles = jest.spyOn(common, "deleteFiles").mockImplementationOnce(async () => true)
  })

  afterEach(() => {
    mockReaddirp.mockReset()
    mockFetchMedia.mockReset()
    mockUploadMedia.mockReset()
    mockDeleteFiles.mockReset()
  })

  it("Uploads new files to the server", async () => {
    mockReaddirp.mockReset()
    mockReaddirp.mockImplementationOnce(async () => [{ fullPath: "Foobar" }, { fullPath: "Barfoo" }])
    await watch.sync({}, "", {}, new Set())
    expect(mockReaddirp).toBeCalledTimes(1)
    expect(mockFetchMedia).toBeCalledTimes(1)
    expect(mockUploadMedia).toBeCalledTimes(1)
  })

  it("Deletes files after successful upload", async () => {
    mockReaddirp.mockReset()
    mockReaddirp.mockImplementationOnce(async () => [{ fullPath: "Foobar" }, { fullPath: "Barfoo" }])
    await watch.sync({}, "", { "delete-after-upload": true }, new Set())
    expect(mockReaddirp).toBeCalledTimes(1)
    expect(mockFetchMedia).toBeCalledTimes(0)
    expect(mockUploadMedia).toBeCalledTimes(1)
    expect(mockDeleteFiles).toBeCalledTimes(1)
    expect(mockDeleteFiles).toBeCalledWith(["Foobar", "Barfoo"])
  })

  it("Doesn't delete files if upload fails", async () => {
    mockReaddirp.mockReset()
    mockReaddirp.mockImplementationOnce(async () => [{ fullPath: "Foobar" }, { fullPath: "Barfoo" }])
    mockUploadMedia.mockReset()
    mockUploadMedia.mockImplementationOnce(async () => false)
    await watch.sync({}, "", { "delete-after-upload": true }, new Set())
    expect(mockDeleteFiles).toBeCalledTimes(0)
  })

  it("Doesn't fetch media if --delete-after-upload flag is set", async () => {
    mockReaddirp.mockReset()
    mockReaddirp.mockImplementationOnce(async () => [{ fullPath: "Foobar" }, { fullPath: "Barfoo" }])
    await watch.sync({}, "", { "delete-after-upload": true }, new Set())
    expect(mockFetchMedia).toBeCalledTimes(0)
  })

  it("Doesn't try to upload anything if there are no files", async () => {
    await watch.sync({}, "", {}, new Set())
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
    await watch.sync({}, "", {}, new Set())
    expect(mockReaddirp).toBeCalledTimes(1)
    expect(mockFetchMedia).toBeCalledTimes(1)
    expect(mockUploadMedia).toBeCalledTimes(0)
  })

  it("Runs sync again if called while it is being executed", async () => {
    mockReaddirp.mockReset()
    mockReaddirp.mockImplementation(async () => [{ basename: "Foobar" }, { basename: "Barfoo" }])
    mockFetchMedia.mockReset()
    mockFetchMedia = jest.spyOn(common, "fetchMedia").mockImplementation(
      () =>
        new Promise(resolve => {
          setTimeout(() => resolve([]), 100)
        })
    )

    const promise = watch.sync({}, "", {}, new Set())
    await watch.sync({}, "", {}, new Set())
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
