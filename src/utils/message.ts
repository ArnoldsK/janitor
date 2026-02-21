import { Message } from "discord.js"

import { Context } from "~/types"

const DELETE_MANY_CONCURRENCY = 5

interface DiscordMessageItem {
  channelId: string
  messageId: string
}

export const getOrFetchMessage = async (
  context: Context,
  item: DiscordMessageItem,
): Promise<Message | null> => {
  const guild = context.guild()
  const channel =
    guild.channels.cache.get(item.channelId) ??
    (await guild.channels.fetch(item.channelId))

  if (!channel?.isTextBased()) {
    throw new Error("Channel not found")
  }

  try {
    const message =
      channel.messages.cache.get(item.messageId) ??
      (await channel.messages.fetch(item.messageId))

    return message
  } catch {
    return null
  }
}

export const deleteDiscordMessage = async (
  context: Context,
  { channelId, messageId }: DiscordMessageItem,
) => {
  try {
    const guild = context.guild()
    const channel =
      guild.channels.cache.get(channelId) ??
      (await guild.channels.fetch(messageId))

    if (!channel?.isTextBased()) {
      throw new Error("Channel not found")
    }

    await channel.messages.delete(messageId)
  } catch {
    // Ignore errors
  }
}

export const deleteManyDiscordMessages = async (
  context: Context,
  items: DiscordMessageItem[],
) => {
  if (items.length === 0) return

  for (let i = 0; i < items.length; i += DELETE_MANY_CONCURRENCY) {
    const slice = items.slice(i, i + DELETE_MANY_CONCURRENCY)

    await Promise.all(slice.map((item) => deleteDiscordMessage(context, item)))
  }
}
