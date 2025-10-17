import { AutoDelete } from "~/modules"
import { Context } from "~/types"
import { dedupe } from "~/utils/array"

export const deleteByUserId = async (context: Context, userIds: string[]) => {
  if (userIds.length === 0) return

  await context
    .db(AutoDelete.db.TableName)
    .whereIn("user_id", dedupe(userIds))
    .delete()
}
