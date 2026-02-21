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
  "Note: The messages are primarily in Latvian; parse the sentiment carefully but provide the verdict in English.",
  "",
  "**Task:**",
  "Provide a single, cohesive paragraph that identifies the user's archetype and provides an honest, objective analysis of their social disposition and personality.",
  "",
  "**Strict Constraints:**",
  "- Output MUST be a single paragraph.",
  "- No headers, no bullet points, and no introductory filler.",
  "- Be honest and real; do not sugarcoat, but do not forcedly roast.",
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
        // Offset to skip messages that might be asking about this command invocation
        offset: 3,
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

    await interaction.editReply({
      content: [
        `**Profile Analysis of** <@${user.id}>`,
        `-# Sample: ${entries.length} messages`,
        profilingResult,
      ].join("\n"),
    })
  },
})
