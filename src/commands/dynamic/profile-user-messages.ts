import fs from "node:fs/promises"
import path from "node:path"

import { MessageType, PermissionFlagsBits } from "discord.js"

import { appConfig } from "~/config"
import { UserMessage } from "~/entities"
import { createCommand } from "~/utils/command"
import { getOrFetchMessage } from "~/utils/message"
import { isNonNullish } from "~/utils/types"

enum CommandOptionName {
  User = "user",
}

const PROFILE_MESSAGE_LIMIT = 100

const USER_MESSAGE_LOG_PATH = path.join(
  process.cwd(),
  "logs",
  "profile_user_messages.txt",
)

const SYSTEM_PROMPT = [
  "You are a blunt, observant behavioral profiler. Analyze the provided Discord messages.",
  "Note: Messages are primarily in Latvian; parse sentiment carefully but reply in Latvian.",
  "",
  "**Task:**",
  "Write a single, high-signal paragraph. Do NOT just list their interests (e.g., 'he likes cars'). Instead, identify their social role and behavioral quirks.",
  "",
  "**Strict Constraints:**",
  "- Output MUST be in Latvian.",
  "- Avoid generic 'horoscope' filler like 'zinātkārs' or 'piedzīvojumu meklētājs'.",
  "- Focus on patterns: Is the user a 'devil's advocate'? A constant complainer? A quiet expert? A source of chaos?",
  "- Identify one specific quirk: How do they handle disagreement? Are they brief and cold, or wordy and defensive?",
  "- Use sharp, modern, and direct Latvian.",
  "- Total response must be under 80 words. No headers.",
  "- If data is insufficient, state: 'Lietotājs ir klusētājs; nav pietiekami daudz datu.'",
].join("\n")

export default createCommand({
  version: 1,

  description: "Profile user based on their recent messages",

  permissions: [PermissionFlagsBits.Administrator],

  options: (builder) =>
    builder.addUserOption((option) =>
      option
        .setName(CommandOptionName.User)
        .setDescription("User to profile")
        .setRequired(true),
    ),

  execute: async (context, interaction) => {
    const ai = context.ai
    if (!ai) {
      throw new Error("AI client not initialized")
    }

    const user = interaction.options.getUser(CommandOptionName.User, true)
    if (user.bot) {
      await interaction.reply({
        flags: "Ephemeral",
        content: "Cannot profile a bot user.",
      })
      return
    }

    await interaction.deferReply({
      flags: appConfig.isDev ? "Ephemeral" : undefined,
    })

    const entries = await UserMessage.select(context, {
      filter: {
        userId: user.id,
      },
      pagination: {
        limit: PROFILE_MESSAGE_LIMIT,
        offset: 0,
      },
    })

    if (entries.length === 0) {
      await interaction.editReply({
        content: "No messages found for this user",
      })
      return
    }

    const messages = await Promise.all(
      entries.map((entry) =>
        getOrFetchMessage(context, {
          channelId: entry.channel_id,
          messageId: entry.message_id,
        }),
      ),
    )

    const messageLog = messages
      .filter(isNonNullish)
      .filter(
        (message) =>
          !message.author.bot &&
          message.type !== MessageType.ChatInputCommand &&
          message.cleanContent.length > 0,
      )
      .map(
        (message) =>
          `${message.createdTimestamp / 1000}: "${message.cleanContent}"`,
      )
      .join("\n")

    if (messageLog.length === 0) {
      await interaction.editReply({
        content: "No messages with content found for this user",
      })
      return
    }

    const response = await ai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: messageLog,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
    })

    const profilingResult =
      response.choices[0]?.message?.content?.trim() ?? "No profiling result."

    await interaction.editReply({
      content: [
        `**Profile Analysis of** <@${user.id}>`,
        `-# Sample: ${entries.length} messages`,
        profilingResult,
      ].join("\n"),
    })

    // Log the most recent message and profiling result for debugging and analysis
    const logEntry = [
      `--- ${new Date().toISOString()} ---`,
      `User: ${user.tag} (${user.id})`,
      `Profiling Result: ${profilingResult}`,
      "",
      messageLog,
      "",
    ].join("\n")

    await fs.mkdir(path.dirname(USER_MESSAGE_LOG_PATH), { recursive: true })
    await fs.writeFile(USER_MESSAGE_LOG_PATH, logEntry)
  },
})
