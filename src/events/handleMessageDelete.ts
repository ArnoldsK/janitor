import { Message } from "discord.js"

import { Table, TABLE_NAME } from "~/constants/table"
import { BaseContext } from "~/types"

export const handleMessageDelete = async (
  context: BaseContext,
  message: Pick<Message, "id">,
) => {
  await context.db<Table>(TABLE_NAME).where("message_id", message.id).delete()
}
