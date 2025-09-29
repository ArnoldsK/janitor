import { Message } from "discord.js"
import { BaseContext } from "../types"
import { Table, TABLE_NAME } from "../constants/table"

export const handleMessageDelete = async (
  context: BaseContext,
  message: Pick<Message, "id">,
) => {
  await context.db<Table>(TABLE_NAME).where("message_id", message.id).delete()
}
