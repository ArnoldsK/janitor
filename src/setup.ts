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
    console.log(`Updating ${commandsToUpdate.size} command(s):`)
    console.log(
      [...commandsToUpdate.keys()].map((name) => `- ${name}`).join("\n"),
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

  const tasksToSchedule = [...cronTasks.entries()].filter(([, task]) => {
    if (task.productionOnly && appConfig.isDev) {
      return false
    }
    return true
  })
  if (tasksToSchedule.length === 0) return

  for (const [name, cronTask] of tasksToSchedule) {
    if (cronTask.productionOnly && appConfig.isDev) return

    cron.schedule(cronTask.expression, async () => {
      if (appConfig.isDev) {
        console.log(`Executing cron task: ${name}`)
      }

      try {
        await cronTask.execute(context)
      } catch (error) {
        console.error(`Error executing cron task ${name}:`, error)
      }
    })
  }

  console.log(`Scheduled ${tasksToSchedule.length} task(s):`)
  console.log(tasksToSchedule.map(([name]) => `- ${name}`).join("\n"))
}
