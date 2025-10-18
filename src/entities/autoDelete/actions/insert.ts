import { AutoDelete } from "~/entities"
import { Context } from "~/types"

export const insert = async (
  context: Context,
  data: AutoDelete.db.InsertData,
) => {
  await context.db(AutoDelete.db.TableName).insert(data).onConflict().merge()
}
