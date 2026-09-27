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
  "Write a single, high-signal paragraph about what distinguishes this person's participation in the chat. Do not just list interests or assign a personality type.",
  "",
  "**Strict Constraints:**",
  "- Output MUST be in Latvian.",
  "- Avoid generic 'horoscope' filler like 'zinātkārs' or 'piedzīvojumu meklētājs'.",
  "- Base each observation on recurring, distinctive behavior in the messages: e.g. how they ask questions, help others, change topics, or respond to disagreement. Mention a quirk only when the messages support it; do not invent a social role or reaction to disagreement.",
  "- Call the user sarcastic or ironic only if multiple messages clearly show a gap between literal wording and intended meaning. Jokes, teasing, slang, emojis, and bluntness alone are not evidence of sarcasm. If ambiguous, describe the observable wording or interaction instead.",
  "- Prefer one or two concrete patterns that distinguish this user over broad labels that could fit anyone. Do not quote private messages or claim to know motives.",
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

    const messageLogs = messages
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

    if (messageLogs.length === 0) {
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
          content: messageLogs.join("\n"),
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
        `-# Sample: ${messageLogs.length} messages`,
        profilingResult,
      ].join("\n"),
    })

    // Log the most recent message and profiling result for debugging and analysis
    const logEntry = [
      `--- ${new Date().toISOString()} ---`,
      `User: ${user.tag} (${user.id})`,
      `Profiling Result: ${profilingResult}`,
      "",
      messageLogs.join("\n"),
      "",
    ].join("\n")

    await fs.mkdir(path.dirname(USER_MESSAGE_LOG_PATH), { recursive: true })
    await fs.writeFile(USER_MESSAGE_LOG_PATH, logEntry)
  },
})
