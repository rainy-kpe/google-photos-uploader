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
