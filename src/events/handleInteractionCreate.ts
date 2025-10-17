import {
  GuildMember,
  Interaction,
  MessageFlags,
  PermissionsBitField,
} from "discord.js"

import { commands } from "~/commands"
import { appConfig } from "~/config"
import { BaseContext } from "~/types"
import { ParsedCommandInteraction } from "~/utils/command"

export const handleInteractionCreate = async (
  context: BaseContext,
  interaction: Interaction,
) => {
  if (!interaction.isChatInputCommand()) return

  try {
    const command = commands.get(interaction.commandName)
    if (!command) {
      throw new Error("Unknown command")
    }

    const guild = interaction.guild
    if (!guild || guild.id !== appConfig.guildId) {
      throw new Error("Unknown guild")
    }

    const member = interaction.member
    if (!member || !(member instanceof GuildMember)) {
      throw new Error("Unknown member")
    }

    if (
      command.permissions.length > 0 &&
      !command.permissions.some((perm) =>
        (member.permissions as PermissionsBitField).has(perm),
      )
    ) {
      throw new Error("No permissions to run this command")
    }

    await command.execute(
      context,
      // The assertion is safe because we check for the types above
      interaction as ParsedCommandInteraction,
    )
  } catch (error) {
    console.error("Command error:", error)
    await interaction.reply({
      flags: [MessageFlags.Ephemeral],
      content: (error as Error).message,
    })
  }
}
