import commandLineArgs from "command-line-args"
import commandLineUsage, { Section, OptionDefinition } from "command-line-usage"
import { command as configCommand } from "./config"
import { command as watchCommand } from "./watch"

const helpCommand: OptionDefinition = {
  name: "help",
  description: "Print this usage guide."
}

const commands = [configCommand, watchCommand, helpCommand]

const sections: Section[] = [
  {
    header: "Google Photos Uploader",
    content: "Monitors a folder and uploads new images and videos to Google Photos album."
  },
  {
    header: "Synopsis",
    content: "$ node dist/main.js <command> <options>"
  },
  {
    header: "Commands",
    content: commands
  },
  {
    header: "",
    content: "Run 'node dist/main.js help <command>' for help with a specific command."
  }
]

const usage = () => {
  console.log(commandLineUsage(sections))
}

const main = () => {
  const mainOptions = commandLineArgs(commands, { stopAtFirstUnknown: true })
  const argv = mainOptions._unknown || []

  if (mainOptions.command === "help") {
    console.log(mainOptions)
  } else {
    usage()
  }
}

main()

/*

console.log("mainOptions\n===========")
console.log(mainOptions)

if (mainOptions.command === "merge") {
  const mergeDefinitions = [
    { name: "squash", type: Boolean },
    { name: "message", alias: "m" }
  ]
  const mergeOptions = commandLineArgs(mergeDefinitions, { argv })

  console.log("\nmergeOptions\n============")
  console.log(mergeOptions)
}
*/
