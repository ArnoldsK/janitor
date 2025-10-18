import { AutoDelete } from "~/entities"
import { Context } from "~/types"
import { createCommand, ParsedCommandInteraction } from "~/utils/command"
import { d, dSubtractRelative } from "~/utils/date"
import { assertUnreachable } from "~/utils/error"

enum SubCommandName {
  Enable = "enable",
  Disable = "disable",
  Status = "status",
}

enum CommandOptionName {
  Before = "older-than",
}

export default createCommand({
  version: 3,

  description: "Auto-delete messages older than a specified duration",

  permissions: [],

  options: (builder) =>
    builder
      .addSubcommand((subcommand) =>
        subcommand
          .setName(SubCommandName.Enable)
          .setDescription("Enable auto-deletion of old messages")
          .addStringOption((option) =>
            option
              .setName(CommandOptionName.Before)
              .setDescription(
                'Auto-delete new messages after "1 day", "2 weeks", etc. Minimum is "1 hour".',
              )
              .setRequired(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName(SubCommandName.Disable)
          .setDescription("Disable auto-deletion"),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName(SubCommandName.Status)
          .setDescription("Check the status of auto-deletion"),
      ),

  execute: async (context, interaction) => {
    const subcommand = interaction.options.getSubcommand(true) as SubCommandName

    switch (subcommand) {
      case SubCommandName.Enable: {
        await handleEnable(context, interaction)
        break
      }
      case SubCommandName.Disable: {
        await handleDisable(context, interaction)
        break
      }
      case SubCommandName.Status: {
        await handleStatus(context, interaction)
        break
      }
      default: {
        assertUnreachable(subcommand)
      }
    }
  },
})

const handleEnable = async (
  context: Context,
  interaction: ParsedCommandInteraction,
) => {
  const beforeInput = interaction.options.getString(
    CommandOptionName.Before,
    true,
  )
  const before = beforeInput ? dSubtractRelative(beforeInput) : undefined

  if (!before) {
    throw new Error(`Invalid "${CommandOptionName.Before}" date format`)
  }

  if (before.isAfter(d().subtract(1, "hour"))) {
    throw new Error(
      `The "${CommandOptionName.Before}" duration must be at least 1 hour`,
    )
  }

  const beforeHours = Math.floor(d().diff(before, "hours", true))

  await AutoDelete.insert(context, {
    user_id: interaction.user.id,
    delete_before_hours: beforeHours,
  })

  await interaction.reply({
    flags: "Ephemeral",
    content: [
      `Auto-deletion enabled for messages older than ${d(before).fromNow(true)}`,
      "-# Only new messages will be auto-deleted!",
    ].join("\n"),
  })
}

const handleDisable = async (
  context: Context,
  interaction: ParsedCommandInteraction,
) => {
  await AutoDelete.deleteByUserId(context, [interaction.user.id])

  await interaction.reply({
    flags: "Ephemeral",
    content: "Auto-deletion disabled",
  })
}

const handleStatus = async (
  context: Context,
  interaction: ParsedCommandInteraction,
) => {
  const [entity] = await AutoDelete.byUserId(context, [interaction.user.id])

  const before = entity
    ? d().subtract(entity.delete_before_hours ?? 0, "hours")
    : null

  await interaction.reply({
    flags: "Ephemeral",
    content: before
      ? `Auto-deletion is enabled for messages older than ${d(before).fromNow(true)}`
      : "Auto-deletion is not enabled",
  })
}
