import { Message, MessageType } from "discord.js"

import { UserMessage } from "~/entities"
import { Context } from "~/types"

export const handleMessageCreate = async (
  context: Context,
  message: Message,
) => {
  if (message.author.bot && message.type !== MessageType.ChatInputCommand)
    return
  if (!message.channel.isTextBased()) return

  // Ignore interaction calls as it's not a real user message
  // It's not found by "from:user_id" queries and would just take up space without providing value
  if (message.type === MessageType.ChatInputCommand) return

  await UserMessage.insert(context, {
    message_id: message.id,
    channel_id: message.channel.id,
    user_id: message.author.id,
    created_at: message.createdAt,
  })
}
