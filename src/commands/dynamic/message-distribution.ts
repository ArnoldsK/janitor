import { MessageFlags, PermissionFlagsBits } from "discord.js"

import { getMessageDistributionTreemapBuffer } from "~/canvas/distribution"
import { UserMessage } from "~/entities"
import { createCommand } from "~/utils/command"
import { dSubtractRelative } from "~/utils/date"

enum CommandOptionName {
  User = "user",
  After = "newer-than",
}

export default createCommand({
  version: 1,

  description: "Show distribution of user messages over time",

  permissions: [PermissionFlagsBits.Administrator],

  options: (builder) =>
    builder
      .addUserOption((option) =>
        option
          .setName(CommandOptionName.User)
          .setDescription("User to show message distribution for")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName(CommandOptionName.After)
          .setDescription(
            'Optionally show messages newer than "1 day", "2 weeks", etc.',
          ),
      ),

  execute: async (context, interaction) => {
    const user = interaction.options.getUser(CommandOptionName.User, true)
    const afterInput = interaction.options.getString(CommandOptionName.After)
    const after = afterInput ? dSubtractRelative(afterInput) : undefined

    if (afterInput && !after) {
      throw new Error(`Invalid "${CommandOptionName.After}" date format`)
    }

    const countByChannelId = await UserMessage.countByChannelId(context, {
      userId: user.id,
      newerThan: after?.toDate() ?? undefined,
    })

    if (countByChannelId.length === 0) {
      await interaction.reply({
        flags: [MessageFlags.Ephemeral],
        content: `No messages found for <@${user.id}>`,
      })
      return
    }

    await interaction.deferReply()

    const channels = context.client.guilds.cache.get(interaction.guildId!)!
      .channels.cache

    const countByChannel = countByChannelId
      .filter(({ channel_id, count }) => count > 0 && channels.has(channel_id))
      .map(({ channel_id, count }) => {
        const channel = channels.get(channel_id)!
        const prefix = channel.isThread() ? "&" : "#"

        return {
          channel: `${prefix}${channel.name}`,
          count,
        }
      })

    const buffer = getMessageDistributionTreemapBuffer({
      rawData: countByChannel,
    })

    await interaction.editReply({
      content: `Message distribution for <@${user.id}>${
        after ? ` since ${after.format("YYYY-MM-DD")}` : ""
      }:`,
      files: [{ attachment: buffer, name: "message-distribution.png" }],
    })
  },
})
