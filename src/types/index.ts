import { Client } from "discord.js"
import { Knex } from "knex"

export interface Cache {
  isDeletingMessages: boolean
}

export interface Context {
  readonly client: Client
  readonly db: Knex
  readonly cache: Cache
}

export type Nullish<T> = T | null | undefined
