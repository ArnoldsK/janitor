import { AutoDelete, UserMessage } from "~/modules"
import { CronTask } from "~/types"
import { d } from "~/utils/date"
import { deleteManyDiscordMessages } from "~/utils/message"

export default {
  // expression: "0 * * * *", // Every hour
  expression: "* * * * *", // Every minute

  // productionOnly: true,
  productionOnly: false,

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
  },
} satisfies CronTask
