import { ChannelType, SlashCommandBuilder } from "discord.js"
import { appConfig } from "../config"

export const COMMAND_NAME = appConfig.isDev
  ? "dev-delete-user-messages"
  : "delete-user-messages"

export enum CommandOptionName {
  UserId = "user_id",
  Confirmation = "confirmation",
  Channel = "channel",
  IgnoreChannel = "ignore_channel",
  Before = "before",
}

export const COMMAND = new SlashCommandBuilder()
  .setName(COMMAND_NAME)
  .setDescription(
    "Delete all messages for an user (can only be used in the logs channel)",
  )
  .addStringOption((option) =>
    option
      .setName(CommandOptionName.UserId)
      .setDescription("User ID to delete messages for")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName(CommandOptionName.Confirmation)
      .setDescription("This action cannot be stopped. Type DELETE to confirm!")
      .setRequired(true),
  )
  .addChannelOption((option) =>
    option
      .setName(CommandOptionName.Channel)
      .setDescription("Limit messages to a single channel")
      .addChannelTypes(ChannelType.GuildText),
  )
  .addChannelOption((option) =>
    option
      .setName(CommandOptionName.IgnoreChannel)
      .setDescription("Ignore messages from a channel")
      .addChannelTypes(ChannelType.GuildText),
  )
  .addStringOption((option) =>
    option
      .setName(CommandOptionName.Before)
      .setDescription('Limit messages to before "1 day", "2 weeks", etc.'),
  )
