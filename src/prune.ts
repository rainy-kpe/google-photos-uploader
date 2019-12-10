import { CommandLineOptions } from "command-line-args"

export const prune = async (options: CommandLineOptions) => {}

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
    }
  ],
  exec: prune
}
