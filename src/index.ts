import {
  APIApplicationCommand,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
} from "discord.js"
import knex from "knex"

import { handleInteraction } from "./events/handleInteraction"
import { COMMAND, COMMAND_NAME } from "./constants/command"
import { appConfig } from "./config"
import { BaseContext } from "./types"
import { handleMessageCreate } from "./events/handleMessageCreate"
import { handleMessageDelete } from "./events/handleMessageDelete"

const app = async () => {
  // #############################################################################
  // Database
  // #############################################################################
  const db = knex({
    client: "mysql2",
    connection: appConfig.db,
  })

  // #############################################################################
  // Client
  // #############################################################################
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
    ],
    allowedMentions: {
      parse: ["users"],
    },
  })

  // #############################################################################
  // Context
  // #############################################################################
  const context: BaseContext = {
    client,
    db,
    cache: {
      isDeletingMessages: false,
    },
  }

  // #############################################################################
  // Events
  // #############################################################################
  client.once(Events.ClientReady, () => {
    console.log("Client ready!")
  })

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return
    if (interaction.commandName !== COMMAND_NAME) return

    try {
      await handleInteraction(context, interaction)
    } catch (error) {
      await interaction.reply({
        flags: [MessageFlags.Ephemeral],
        content: (error as Error).message,
      })
    }
  })

  client.on(Events.MessageCreate, async (message) => {
    await handleMessageCreate(context, message)
  })

  client.on(Events.MessageDelete, async (message) => {
    await handleMessageDelete(context, message)
  })

  // #############################################################################
  // Upsert the API command
  // #############################################################################
  const rest = new REST({ version: "10" }).setToken(appConfig.discordToken)
  const apiCommand = (await rest.post(
    Routes.applicationGuildCommands(appConfig.clientId, appConfig.guildId),
    { body: COMMAND.toJSON() },
  )) as APIApplicationCommand

  // #############################################################################
  // Login
  // #############################################################################
  await client.login(appConfig.discordToken)

  // #############################################################################
  // Shutdown
  // #############################################################################
  process.on("SIGINT", async () => {
    // #############################################################################
    // Delete the API command
    // #############################################################################
    if (appConfig.isDev) {
      await rest.delete(
        Routes.applicationGuildCommand(
          appConfig.clientId,
          appConfig.guildId,
          apiCommand.id,
        ),
      )
    }

    process.exit(2)
  })
}

app()
