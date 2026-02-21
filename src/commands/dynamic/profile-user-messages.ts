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
  "You are a straight-talking behavioral profiler. Analyze the provided Discord messages (Format: [UnixTimestamp]: Message).",
  "Note: The messages are primarily in Latvian.",
  "",
  "**Task:**",
  "Provide a single, cohesive paragraph identifying the user's archetype and an honest, objective analysis of their personality.",
  "",
  "**Strict Constraints:**",
  "- Output MUST be in Latvian.",
  "- Use plain, direct, and modern Latvian. Avoid being overly formal or robotic.",
  "- Write as an observant peer describing a person to a friend.",
  "- Output MUST be a single paragraph.",
  "- Be honest and real; do not sugarcoat, but do not forcedly roast.",
  "- Total response must be under 80 words.",
  "- Only if there is absolutely ZERO useful text (e.g., only emojis or bot commands), state: 'Lietotājs ir klusētājs; nav pietiekami daudz datu profilam.'",
  "- If there is even a small amount of text, do your best to provide a profile based on the available vibe.",
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
      max_tokens: 150,
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
