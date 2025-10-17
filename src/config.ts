import { Knex } from "knex"
import z from "zod"

const env = z
  .object({
    DEVELOPMENT: z.enum(["true", "false"]),

    CLIENT_ID: z.string(),
    DISCORD_TOKEN: z.string(),

    DB_HOST: z.string(),
    DB_PORT: z.string().regex(/\d+/),
    DB_USERNAME: z.string(),
    DB_PASSWORD: z.string(),
    DB_DATABASE: z.string(),
  })
  .parse(process.env)

export const appConfig = {
  isDev: env.DEVELOPMENT === "true",

  clientId: env.CLIENT_ID as string,
  discordToken: env.DISCORD_TOKEN as string,
  guildId: "411593263615836172",

  db: {
    host: env.DB_HOST,
    port: Number.parseInt(env.DB_PORT, 10),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
  } satisfies Knex.MySql2ConnectionConfig,
}
