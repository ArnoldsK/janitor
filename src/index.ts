import "dotenv/config"
import { Client, Events, GatewayIntentBits } from "discord.js"
import knex from "knex"

import { appConfig } from "~/config"
import { handleInteractionCreate } from "~/events/handleInteractionCreate"
import { handleMessageCreate } from "~/events/handleMessageCreate"
import { handleMessageDelete } from "~/events/handleMessageDelete"
import { BaseContext } from "~/types"
import { removeApiCommands, setupApiCommands } from "~/utils/setup"

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
    await handleInteractionCreate(context, interaction)
  })

  client.on(Events.MessageCreate, async (message) => {
    await handleMessageCreate(context, message)
  })

  client.on(Events.MessageDelete, async (message) => {
    await handleMessageDelete(context, message)
  })

  // #############################################################################
  // API commands
  // #############################################################################
  await setupApiCommands()

  // #############################################################################
  // Login
  // #############################################################################
  await client.login(appConfig.discordToken)

  // #############################################################################
  // Shutdown
  // #############################################################################
  process.on("SIGINT", async () => {
    // Delete API commands
    if (appConfig.isDev) {
      await removeApiCommands()
    }

    process.exit(2)
  })
}

app()
