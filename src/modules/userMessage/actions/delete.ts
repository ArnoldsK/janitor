import { UserMessage } from "~/modules"
import { Context } from "~/types"
import { dedupe } from "~/utils/array"

export const deleteByMessageId = async (
  context: Context,
  messageIds: string[],
) => {
  if (messageIds.length === 0) return

  await context
    .db(UserMessage.db.TableName)
    .whereIn("message_id", dedupe(messageIds))
    .delete()
}
