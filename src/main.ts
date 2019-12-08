import commandLineArgs from "command-line-args"
import commandLineUsage, { Section, OptionDefinition } from "command-line-usage"
import { definition as configdefinition } from "./config"
import { definition as watchdefinition } from "./watch"

const definitions = {
  [configdefinition.command.name]: configdefinition,
  [watchdefinition.command.name]: watchdefinition
}

const helpCommand: OptionDefinition = {
  name: "help",
  description: "Print this usage guide."
}

const commands = [configdefinition.command, watchdefinition.command, helpCommand]

const sectionTitle: Section = {
  header: "Google Photos Uploader",
  content: "Monitors a folder and uploads new images and videos to Google Photos album."
}

const sectionSynopsis: Section = {
  header: "Synopsis",
  content: "$ node dist/main.js <command> <options>"
}

const sectionCommands: Section = {
  header: "Commands",
  content: commands
}

const sectionHelp = {
  content: "Run 'node dist/main.js help <command>' for help with a specific command."
}

const showCommandHelp = (command: string) => {
  const hasOptions = definitions[command].options.length !== 0
  const sectionHelpSynopsis: Section = {
    header: "Synopsis",
    content: `$ node dist/main.js ${command} ${hasOptions ? "<options>" : ""}`
  }
  const sectionCommand: Section = {
    header: `Command: ${command}`,
    content: definitions[command].command.description
  }
  const sectionOptions: Section = {
    header: "Options",
    optionList: definitions[command].options
  }
  console.log(commandLineUsage([sectionTitle, sectionCommand, sectionHelpSynopsis, hasOptions ? sectionOptions : {}]))
}

const main = () => {
  const mainOptions = commandLineArgs([{ name: "command", defaultOption: true }], { stopAtFirstUnknown: true })
  const argv = mainOptions._unknown || []

  if (mainOptions.command === "help") {
    const helpOptions = commandLineArgs([{ name: "command", defaultOption: true }], { stopAtFirstUnknown: true, argv })
    if (definitions[helpOptions.command]) {
      showCommandHelp(helpOptions.command)
    } else if (!helpOptions.command) {
      console.log(commandLineUsage([sectionTitle, sectionSynopsis, sectionCommands, sectionHelp]))
    } else {
      console.log(`Unknown command: ${helpOptions.command}`)
    }
  } else if (!mainOptions.command) {
    console.log(commandLineUsage([sectionTitle, sectionSynopsis, sectionCommands, sectionHelp]))
  } else if (definitions[mainOptions.command]) {
    let commandOptions = {}
    try {
      commandOptions = commandLineArgs(definitions[mainOptions.command].options, { argv })
    } catch (error) {
      console.log(`Unknown option: ${error.optionName}`)
      process.exit(1)
    }
    definitions[mainOptions.command].exec(commandOptions)
  } else {
    console.log(`Unknown command: ${mainOptions.command}`)
  }
}

main()
