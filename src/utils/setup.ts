import {
  APIApplicationCommand,
  REST,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  Routes,
} from "discord.js"

import { commands } from "~/commands"
import { appConfig } from "~/config"
import { getVersionFromDescription } from "~/utils/command"

export const setupApiCommands = async () => {
  const rest = new REST({ version: "10" }).setToken(appConfig.discordToken)

  const apiCommands = (await rest.get(
    Routes.applicationGuildCommands(appConfig.clientId, appConfig.guildId),
  )) as APIApplicationCommand[]

  const commandsToUpdate = new Map<
    string,
    RESTPostAPIChatInputApplicationCommandsJSONBody
  >(
    // [...commands.values()]
    [...commands.values()]
      .filter((cmd) => {
        const existing = apiCommands.find((apiCmd) => apiCmd.name === cmd.name)

        return (
          !existing ||
          getVersionFromDescription(existing.version) !== cmd.version
        )
      })
      .map((cmd) => [cmd.name, cmd.data]),
  )

  if (commandsToUpdate.size > 0) {
    await rest.put(
      Routes.applicationGuildCommands(appConfig.clientId, appConfig.guildId),
      {
        body: [
          ...apiCommands.filter(
            (cmd) =>
              // Command is not removed
              commands.has(cmd.name) &&
              // Command does not need an update
              !commandsToUpdate.has(cmd.name),
          ),
          ...commandsToUpdate.values(),
        ],
      },
    )
  }
}

export const removeApiCommands = async () => {
  const rest = new REST({ version: "10" }).setToken(appConfig.discordToken)

  await rest.put(
    Routes.applicationGuildCommands(appConfig.clientId, appConfig.guildId),
    { body: [] },
  )
}
