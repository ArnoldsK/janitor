import { SlashCommandBuilder } from "discord.js"

import { appConfig } from "~/config"
import {
  Command,
  CommandSetup,
  makeVersionedDescription,
} from "~/utils/command"
import { importDirectoryDefaults } from "~/utils/file"

const getCommandSetups = () =>
  importDirectoryDefaults<CommandSetup>(__dirname, "dynamic")

export const getCommands = async () => {
  const setups = await getCommandSetups()
  const commands = new Map<string, Command>()

  for (const [setupName, setup] of setups.entries()) {
    const name = appConfig.isDev ? `dev-${setupName}` : setupName

    const builder = new SlashCommandBuilder()
      .setName(name)
      .setDescription(
        makeVersionedDescription(setup.description, setup.version),
      )
    const data = setup.options(builder).toJSON()

    const command: Command = {
      name,
      version: setup.version,
      permissions: setup.permissions,
      execute: setup.execute,
      data,
    }

    commands.set(command.name, command)
  }

  return commands
}
