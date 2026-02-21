import { Client, Guild } from "discord.js"
import { Knex } from "knex"
import OpenAI from "openai"

export interface Cache {
  isDeletingMessages: boolean
}

export interface Context {
  readonly client: Client
  readonly db: Knex
  readonly cache: Cache
  readonly guild: () => Guild
  readonly ai: OpenAI | null
}
