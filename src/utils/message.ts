import { Context } from "~/types"

const DELETE_MANY_CONCURRENCY = 5

interface DeleteDiscordMessageItem {
  channelId: string
  messageId: string
}

export const deleteDiscordMessage = async (
  context: Context,
  { channelId, messageId }: DeleteDiscordMessageItem,
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
  items: DeleteDiscordMessageItem[],
) => {
  if (items.length === 0) return

  for (let i = 0; i < items.length; i += DELETE_MANY_CONCURRENCY) {
    const slice = items.slice(i, i + DELETE_MANY_CONCURRENCY)

    await Promise.all(slice.map((item) => deleteDiscordMessage(context, item)))
  }
}
