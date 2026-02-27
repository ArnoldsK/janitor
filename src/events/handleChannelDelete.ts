import { Channel } from "discord.js"

import { UserMessage } from "~/entities"
import { Context } from "~/types"

export const handleChannelDelete = async (
  context: Context,
  channel: Pick<Channel, "id">,
) => {
  await UserMessage.deleteByChannelId(context, [channel.id])
}
