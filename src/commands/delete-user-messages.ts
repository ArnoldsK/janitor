import {
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js"

import { appConfig } from "~/config"
import { Table, TABLE_NAME } from "~/constants/table"
import { BaseContext, Nullish } from "~/types"
import { createCommand } from "~/utils/command"
import { d, dSubtractRelative } from "~/utils/date"

const AVERAGE_MS_PER_BATCH_ITEM = 1777
const LOGS_CHANNEL_ID = "546830997983854592"
const BATCH_SIZE = 100
const CONCURRENCY = 5

enum CommandOptionName {
  UserId = "user_id",
  Confirmation = "confirmation",
  Channel = "channel",
  IgnoreChannel = "ignore_channel",
  Before = "before",
}

interface SelectOptions {
  userId: string
  channelId: Nullish<string>
  ignoreChannelId: Nullish<string>
  beforeDate: Nullish<Date>
}

export default createCommand({
  version: 1,

  description:
    "Delete all messages for an user (can only be used in the logs channel)",

  options: (builder) =>
    builder
      .addStringOption((option) =>
        option
          .setName(CommandOptionName.UserId)
          .setDescription("User ID to delete messages for")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName(CommandOptionName.Confirmation)
          .setDescription(
            "This action cannot be stopped. Type DELETE to confirm!",
          )
          .setRequired(true),
      )
      .addChannelOption((option) =>
        option
          .setName(CommandOptionName.Channel)
          .setDescription("Limit messages to a single channel")
          .addChannelTypes(ChannelType.GuildText),
      )
      .addChannelOption((option) =>
        option
          .setName(CommandOptionName.IgnoreChannel)
          .setDescription("Ignore messages from a channel")
          .addChannelTypes(ChannelType.GuildText),
      )
      .addStringOption((option) =>
        option
          .setName(CommandOptionName.Before)
          .setDescription('Limit messages to before "1 day", "2 weeks", etc.'),
      ),

  permissions: [PermissionFlagsBits.Administrator],

  execute: async (context, interaction) => {
    const member = interaction.member
    if (!member) {
      throw new Error("Member not found")
    }

    if (interaction.channel?.id !== LOGS_CHANNEL_ID) {
      throw new Error(`This command can only be used in <#${LOGS_CHANNEL_ID}>`)
    }

    if (context.cache.isDeletingMessages) {
      throw new Error("Already deleting someone's messages")
    }

    const userId = interaction.options.getString(CommandOptionName.UserId, true)
    const confirmation = interaction.options.getString(
      CommandOptionName.Confirmation,
      true,
    )

    const channel = interaction.options.getChannel(CommandOptionName.Channel)
    const ignoreChannel = interaction.options.getChannel(
      CommandOptionName.IgnoreChannel,
    )
    const before = interaction.options.getString(CommandOptionName.Before)

    if (confirmation !== "DELETE") {
      throw new Error('You must type "DELETE" to confirm')
    }

    if (channel && ignoreChannel && channel.id === ignoreChannel.id) {
      throw new Error("Can't limit to a channel that is also ignored")
    }

    const beforeDate = before ? dSubtractRelative(before)?.toDate() : null
    if (before && !beforeDate) {
      throw new Error("Invalid before date format")
    }

    try {
      context.cache.isDeletingMessages = true

      await handleRemoval(context, interaction, {
        userId,
        channelId: channel?.id,
        ignoreChannelId: ignoreChannel?.id,
        beforeDate,
      })
    } finally {
      context.cache.isDeletingMessages = false
    }
  },
})

const handleRemoval = async (
  context: BaseContext,
  interaction: ChatInputCommandInteraction,
  options: SelectOptions,
) => {
  if (!options.beforeDate) {
    options.beforeDate = new Date()
  }

  let [{ count }] = await getBaseQuery(context, options).count("message_id", {
    as: "count",
  })
  count = Number.parseInt(`${count}`)

  if (Number.isNaN(count) || count === 0) {
    throw new Error("No messages found")
  }

  const plural = count === 1 ? "message" : "messages"
  const estimate = d()
    .add(AVERAGE_MS_PER_BATCH_ITEM * count, "milliseconds")
    .fromNow(true)
  const message = await interaction.reply({
    content: [
      `Deleting ${count} ${plural} for <@${options.userId}>`,
      `-# Estimating ${estimate}`,
    ].join("\n"),
    fetchReply: true,
  })

  let totalTime = 0
  let batchCount = 0

  while (true) {
    const start = Date.now()

    const entries = await getBaseQuery(context, options).limit(BATCH_SIZE)
    if (entries.length === 0) break

    for (let i = 0; i < entries.length; i += CONCURRENCY) {
      const slice = entries.slice(i, i + CONCURRENCY)

      await Promise.all(slice.map((entry) => deleteMessage(context, entry)))
    }

    // Message delete event should already handle this, but just in case...
    await context
      .db(TABLE_NAME)
      .whereIn(
        "message_id",
        entries.map((el) => el.message_id),
      )
      .delete()

    const end = Date.now()
    totalTime += end - start
    batchCount++
  }

  await message.reply(
    [
      "Deleted all messages!",
      batchCount > 0
        ? `-# Average ms per batch item: ${Math.round(
            totalTime / batchCount / BATCH_SIZE,
          )}`
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
  )
}

const getBaseQuery = (context: BaseContext, options: SelectOptions) => {
  const qb = context.db<Table>(TABLE_NAME).where("user_id", options.userId)

  if (options.channelId) {
    qb.where("channel_id", options.channelId)
  }

  if (options.ignoreChannelId) {
    qb.whereNot("channel_id", options.ignoreChannelId)
  }

  if (options.beforeDate) {
    qb.where("created_at", "<=", options.beforeDate)
  }

  return qb
}

const deleteMessage = async (context: BaseContext, entry: Table) => {
  try {
    const guild = context.client.guilds.cache.get(appConfig.guildId)!
    const channel =
      guild.channels.cache.get(entry.channel_id) ??
      (await guild.channels.fetch(entry.channel_id))

    if (!channel?.isTextBased()) {
      throw new Error("Channel not found")
    }

    await channel.messages.delete(entry.message_id)
  } catch {
    // Ignore errors
  }
}
