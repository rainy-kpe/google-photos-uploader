import * as fs from "fs"
import { CommandLineOptions } from "command-line-args"

const watchPath = "/tmp"

export const watch = async (options: CommandLineOptions) => {
  fs.watch(watchPath, (event, filename) => {
    console.log(event, filename)
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
