import {
  APIApplicationCommand,
  REST,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  Routes,
} from "discord.js"
import cron from "node-cron"

import { getCommands } from "~/commands"
import { appConfig } from "~/config"
import { getCronTasks } from "~/cron"
import { Context } from "~/types"
import { getVersionFromDescription } from "~/utils/command"

export const setupApiCommands = async () => {
  const rest = new REST({ version: "10" }).setToken(appConfig.discordToken)

  const commands = await getCommands()
  const apiCommands = (await rest.get(
    Routes.applicationGuildCommands(appConfig.clientId, appConfig.guildId),
  )) as APIApplicationCommand[]

  const commandsToUpdate = new Map<
    string,
    RESTPostAPIChatInputApplicationCommandsJSONBody
  >(
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
    console.log(
      `Updating ${commandsToUpdate.size} command(s):`,
      [...commandsToUpdate.keys()].join("\n"),
    )

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

  console.log("Removing all commands")

  await rest.put(
    Routes.applicationGuildCommands(appConfig.clientId, appConfig.guildId),
    { body: [] },
  )
}

export const setupCronJobs = async (context: Context) => {
  const cronTasks = await getCronTasks()

  console.log(cronTasks)

  for (const [name, cronTask] of cronTasks.entries()) {
    if (cronTask.productionOnly && appConfig.isDev) return

    cron.schedule(cronTask.expression, async () => {
      console.log(`Executing cron task: ${name}`)

      try {
        await cronTask.execute(context)
      } catch (error) {
        console.error(`Error executing cron task ${name}:`, error)
      }
    })

    console.log(`Scheduled cron task: ${name} (${cronTask.expression})`)
  }
}
