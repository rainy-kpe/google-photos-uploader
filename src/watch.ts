import * as fs from "fs"
import { OptionDefinition } from "command-line-usage"

export const command: OptionDefinition = {
  name: "watch",
  description: "Starts watching the folder for new images and videos.",
  defaultOption: true
}

const watchPath = "/tmp"

export const watch = () => {
  fs.watch(watchPath, (event, filename) => {
    console.log(event, filename)
  })
}
