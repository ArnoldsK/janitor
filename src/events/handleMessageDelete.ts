import { Message } from "discord.js"

import { UserMessage } from "~/entities"
import { Context } from "~/types"

export const handleMessageDelete = async (
  context: Context,
  message: Pick<Message, "id">,
) => {
  await UserMessage.deleteByMessageId(context, [message.id])
}
