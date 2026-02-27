import { UserMessage } from "~/entities"
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

export const deleteByChannelId = async (
  context: Context,
  channelIds: string[],
) => {
  if (channelIds.length === 0) return

  await context
    .db(UserMessage.db.TableName)
    .whereIn("channel_id", dedupe(channelIds))
    .delete()
}
