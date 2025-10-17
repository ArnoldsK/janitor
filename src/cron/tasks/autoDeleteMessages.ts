import { AutoDelete, UserMessage } from "~/modules"
import { CronTask } from "~/types"
import { dedupe } from "~/utils/array"
import { d } from "~/utils/date"
import { deleteManyDiscordMessages } from "~/utils/message"
import { isNonNullish } from "~/utils/types"

export default {
  expression: "* * * * *", // Every minute

  productionOnly: true,

  execute: async (context) => {
    const autoDeleteEntities = await AutoDelete.all(context)
    if (autoDeleteEntities.length === 0) return

    const now = d()

    const messageEntitiesToRemove = (
      await Promise.all(
        autoDeleteEntities.map(async (entity) => {
          const gtCreatedAt = entity.created_at
          const lteCreatedAt = now
            .subtract(entity.delete_before_hours, "hours")
            .toDate()

          return await UserMessage.select(context, {
            // Not sure if I need to limit as hourly messages shouldn't be that many, but just in case
            // If there are more than 100 messages to delete per user, it will be handled in the next cron run
            pagination: {
              limit: 100,
              offset: 0,
            },
            filter: {
              userId: entity.user_id,
              gtCreatedAt,
              lteCreatedAt,
            },
          })
        }),
      )
    ).flat()
    if (messageEntitiesToRemove.length === 0) return

    await deleteManyDiscordMessages(
      context,
      messageEntitiesToRemove.map((entity) => ({
        channelId: entity.channel_id,
        messageId: entity.message_id,
      })),
    )

    // Message delete event should already handle this, but just in case...
    await UserMessage.deleteByMessageId(
      context,
      messageEntitiesToRemove.map((entity) => entity.message_id),
    )

    const userIds = dedupe(autoDeleteEntities.map((entity) => entity.user_id))
    const removedUserMessageLogs = userIds
      .map((userId) => {
        const count = messageEntitiesToRemove.filter(
          (entity) => entity.user_id === userId,
        ).length

        return count > 0 ? `- ${userId} (${count})` : null
      })
      .filter(isNonNullish)

    if (removedUserMessageLogs.length > 0) {
      console.log(`Auto-deleted messages for users:`)
      console.log(removedUserMessageLogs.join("\n"))
    }
  },
} satisfies CronTask
