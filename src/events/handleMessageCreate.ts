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

  const authorId =
    message.type === MessageType.ChatInputCommand
      ? message.interactionMetadata?.user.id
      : message.author.id
  if (!authorId) return

  await UserMessage.insert(context, {
    message_id: message.id,
    channel_id: message.channel.id,
    user_id: authorId,
    created_at: message.createdAt,
  })
}
