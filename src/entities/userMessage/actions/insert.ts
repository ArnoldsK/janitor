import { UserMessage } from "~/entities"
import { Context } from "~/types"

export const insert = async (
  context: Context,
  data: UserMessage.db.InsertData,
) => {
  await context.db(UserMessage.db.TableName).insert(data).onConflict().ignore()
}
