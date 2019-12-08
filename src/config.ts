import { CommandLineOptions } from "command-line-args"

const config = (options: CommandLineOptions) => {
  console.log("Config selected", options)
}

export const definition = {
  command: {
    name: "config",
    description: "Configures the Google Photos connection. This must be ran first."
  },
  options: [],
  exec: config
}
