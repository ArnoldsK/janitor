import {
  ChatInputCommandInteraction,
  Guild,
  GuildMember,
  PermissionResolvable,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandOptionsOnlyBuilder,
  TextBasedChannel,
} from "discord.js"

import { Context } from "~/types"

export interface ParsedCommandInteraction extends ChatInputCommandInteraction {
  guild: Guild
  channel: TextBasedChannel
  member: GuildMember
}

type ExecuteFn = (
  context: Context,
  interaction: ParsedCommandInteraction,
) => Promise<void>

export interface CommandSetup {
  version: number
  description: string
  options: (
    builder: SlashCommandOptionsOnlyBuilder,
  ) => SlashCommandOptionsOnlyBuilder
  permissions: PermissionResolvable[]
  execute: ExecuteFn
}

export interface Command {
  name: string
  version: number
  permissions: PermissionResolvable[]
  execute: ExecuteFn
  data: RESTPostAPIChatInputApplicationCommandsJSONBody
}

export const createCommand = (setup: CommandSetup): CommandSetup => setup

export const makeVersionedDescription = (
  description: string,
  version: number,
) => {
  return `${description} · v${version}`
}

export const getVersionFromDescription = (description: string): number => {
  const match = description.match(/· v(\d+)$/)
  if (match) {
    return Number.parseInt(match[1], 10)
  }
  return 1
}
