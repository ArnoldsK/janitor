import { AutoDelete } from "~/modules"
import { Context } from "~/types"

export const all = async (context: Context): Promise<AutoDelete.db.Table[]> => {
  return await context.db(AutoDelete.db.TableName)
}

export const byUserId = async (
  context: Context,
  userId: string[],
): Promise<AutoDelete.db.Table[]> => {
  if (userId.length === 0) {
    return []
  }

  return await context.db(AutoDelete.db.TableName).whereIn("user_id", userId)
}
