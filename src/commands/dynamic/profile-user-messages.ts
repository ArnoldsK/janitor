import { PermissionFlagsBits } from "discord.js"

import { UserMessage } from "~/entities"
import { createCommand } from "~/utils/command"
import { getOrFetchMessage } from "~/utils/message"
import { isNonNullish } from "~/utils/types"

enum CommandOptionName {
  User = "user",
}

const PROFILE_MESSAGE_LIMIT = 50

const SYSTEM_PROMPT = [
  "You are an analytical behavioral profiler. Analyze the provided Discord messages (Format: [UnixTimestamp]: Message).",
  "Note: The messages are primarily in Latvian; analyze the content and sentiment carefully despite the language.",
  "",
  "**Required Output Format:**",
  "**User Archetype:** [Name] — [1 sentence description]",
  "**Vocabulary Traits:** [2-3 key traits, e.g., Bilingual EN/LV, use of slang, formal/informal, tone]",
  "**Social Disposition:** [A 1-2 sentence honest, objective analysis of their social attitude and personality.]",
  "",
  "**Strict Constraints:**",
  "- Output MUST be in English.",
  "- Be honest and real; do not sugarcoat, but do not forcedly roast.",
  "- No introductory filler or meta-talk.",
  "- Total response must be under 80 words.",
  "- If data is insufficient, state: 'User is a lurker; insufficient data to profile.'",
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

    await interaction.deferReply()

    const user = interaction.options.getUser(CommandOptionName.User, true)

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
      .filter((message) => message.cleanContent.length > 2)
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
      temperature: 0.85,
      max_tokens: 150,
    })

    const profilingResult =
      response.choices[0]?.message?.content?.trim() ?? "No profiling result."

    const quotedResult = profilingResult
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n")

    await interaction.editReply({
      content: [
        `**Profile Analysis of** <@${user.id}> (Sample: ${entries.length} messages)`,
        quotedResult,
      ].join("\n"),
    })
  },
})
