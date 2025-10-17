import {
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js"

import { appConfig } from "~/config"
import { UserMessage } from "~/modules"
import { SelectOptions } from "~/modules/UserMessage"
import { Context } from "~/types"
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
    if (interaction.channel.id !== LOGS_CHANNEL_ID) {
      throw new Error(`This command can only be used in <#${LOGS_CHANNEL_ID}>`)
    }

    if (context.cache.isDeletingMessages) {
      throw new Error("Already deleting someone's messages")
    }

    const confirmation = interaction.options.getString(
      CommandOptionName.Confirmation,
      true,
    )
    if (confirmation !== "DELETE") {
      throw new Error('You must type "DELETE" to confirm')
    }

    const filterUserId = interaction.options.getString(
      CommandOptionName.UserId,
      true,
    )
    const filterChannel = interaction.options.getChannel(
      CommandOptionName.Channel,
    )
    const filterNotChannel = interaction.options.getChannel(
      CommandOptionName.IgnoreChannel,
    )
    const before = interaction.options.getString(CommandOptionName.Before)

    if (
      filterChannel &&
      filterNotChannel &&
      filterChannel.id === filterNotChannel.id
    ) {
      throw new Error("Can't limit to a channel that is also ignored")
    }

    const beforeDate = before ? dSubtractRelative(before)?.toDate() : undefined
    if (before && !beforeDate) {
      throw new Error("Invalid before date format")
    }

    try {
      context.cache.isDeletingMessages = true

      await handleRemoval(context, interaction, {
        userId: filterUserId,
        channelId: filterChannel?.id,
        notChannelId: filterNotChannel?.id,
        lteCreatedAt: beforeDate,
      })
    } finally {
      context.cache.isDeletingMessages = false
    }
  },
})

const handleRemoval = async (
  context: Context,
  interaction: ChatInputCommandInteraction,
  filter: NonNullable<SelectOptions["filter"]>,
) => {
  if (!filter.lteCreatedAt) {
    filter.lteCreatedAt = new Date()
  }

  const count = await UserMessage.count(context, filter)
  if (count === 0) {
    throw new Error("No messages found")
  }

  const plural = count === 1 ? "message" : "messages"
  const estimate = d()
    .add(AVERAGE_MS_PER_BATCH_ITEM * count, "milliseconds")
    .fromNow(true)
  const message = await interaction.reply({
    content: [
      `Deleting ${count} ${plural} for <@${filter.userId}>`,
      `-# Estimating ${estimate}`,
    ].join("\n"),
    fetchReply: true,
  })

  let totalTime = 0
  let batchCount = 0

  while (true) {
    const start = Date.now()

    const entries = await UserMessage.select(context, {
      pagination: {
        limit: BATCH_SIZE,
        offset: 0,
      },
      filter,
    })
    if (entries.length === 0) break

    for (let i = 0; i < entries.length; i += CONCURRENCY) {
      const slice = entries.slice(i, i + CONCURRENCY)

      await Promise.all(slice.map((entry) => deleteFromDiscord(context, entry)))
    }

    // Message delete event should already handle this, but just in case...
    await UserMessage.deleteByMessageId(
      context,
      entries.map((e) => e.message_id),
    )

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

const deleteFromDiscord = async (
  context: Context,
  entry: UserMessage.db.Table,
) => {
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
