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

  for (const [name, setup] of setups.entries()) {
    const data = setup
      .options(
        new SlashCommandBuilder()
          .setName(name)
          .setDescription(
            makeVersionedDescription(setup.description, setup.version),
          ),
      )
      .toJSON()

    const command: Command = {
      name: appConfig.isDev ? `dev-${name}` : name,
      version: setup.version,
      permissions: setup.permissions,
      execute: setup.execute,
      data,
    }

    commands.set(command.name, command)
  }

  return commands
}
