import { UserMessage } from "~/modules"
import { Context } from "~/types"

export const insert = async (
  context: Context,
  data: UserMessage.db.InsertData,
) => {
  await context.db(UserMessage.db.TableName).insert(data).onConflict().ignore()
}
