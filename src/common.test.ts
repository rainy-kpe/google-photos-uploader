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

import * as common from "./common"

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

    expect(await common.fetchMedia({})).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, "end"])

    mockRequest.mockReset()
  })

  it("Returns empty array if request fails", async () => {
    mockRequest.mockImplementation(async () => {
      throw { message: "ERROR" }
    })

    expect(await common.fetchMedia({})).toEqual([])

    mockRequest.mockReset()
  })
})
