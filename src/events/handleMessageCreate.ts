import { Message, MessageType } from "discord.js"
import { BaseContext } from "../types"
import { Table, TABLE_NAME } from "../constants/table"

export const handleMessageCreate = async (
  context: BaseContext,
  message: Message,
) => {
  if (message.author.bot && message.type !== MessageType.ChatInputCommand)
    return
  if (!message.channel.isTextBased()) return
  if (
    message.type !== MessageType.ChatInputCommand &&
    !message.interactionMetadata
  )
    return

  const authorId = message.interactionMetadata
    ? message.interactionMetadata.user.id
    : message.author.id

  await context
    .db<Table>(TABLE_NAME)
    .insert({
      message_id: message.id,
      channel_id: message.channel.id,
      user_id: authorId,
      created_at: message.createdAt,
    })
    .onConflict()
    .ignore()
}
