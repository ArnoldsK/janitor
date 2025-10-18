import {
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js"

import { UserMessage } from "~/entities"
import { Context } from "~/types"
import { createCommand } from "~/utils/command"
import { d, dSubtractRelative } from "~/utils/date"
import { deleteManyDiscordMessages } from "~/utils/message"

const AVERAGE_MS_PER_BATCH_ITEM = 1777 // TODO: take example from multiple times and corelate between total msg count
const LOGS_CHANNEL_ID = "546830997983854592"
const BATCH_SIZE = 100

enum CommandOptionName {
  UserId = "user-id",
  Confirmation = "confirmation",
  Channel = "channel",
  IgnoreChannel = "ignore-channel",
  Before = "before",
}

export default createCommand({
  version: 2,

  description:
    "Delete all messages for an user (can only be used in the logs channel)",

  permissions: [PermissionFlagsBits.Administrator],

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
    if (
      filterChannel &&
      filterNotChannel &&
      filterChannel.id === filterNotChannel.id
    ) {
      throw new Error("Can't limit to a channel that is also ignored")
    }

    const filterBefore = interaction.options.getString(CommandOptionName.Before)
    const beforeDate = filterBefore
      ? dSubtractRelative(filterBefore)?.toDate()
      : undefined
    if (filterBefore && !beforeDate) {
      throw new Error("Invalid before date format")
    }

    try {
      context.cache.isDeletingMessages = true

      await handleRemoval(context, interaction, {
        userId: filterUserId,
        channelId: filterChannel?.id,
        notChannelId: filterNotChannel?.id,
        olderThan: beforeDate,
      })
    } finally {
      context.cache.isDeletingMessages = false
    }
  },
})

const handleRemoval = async (
  context: Context,
  interaction: ChatInputCommandInteraction,
  filter: NonNullable<UserMessage.SelectOptions["filter"]>,
) => {
  if (!filter.olderThan) {
    filter.olderThan = new Date()
  }

  const count = await UserMessage.count(context, filter)
  if (count === 0) {
    throw new Error("No messages found")
  }

  const plural = count === 1 ? "message" : "messages"
  const estimate = d()
    .add(AVERAGE_MS_PER_BATCH_ITEM * count, "milliseconds")
    .fromNow(true)

  const response = await interaction.reply({
    content: [
      `Deleting ${count} ${plural} for <@${filter.userId}>`,
      `-# Estimating ${estimate}`,
    ].join("\n"),
    withResponse: true,
  })

  const message = response.resource?.message
  if (!message) {
    throw new Error("Could not get the response message")
  }

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

    await deleteManyDiscordMessages(
      context,
      entries.map((entry) => ({
        channelId: entry.channel_id,
        messageId: entry.message_id,
      })),
    )

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
