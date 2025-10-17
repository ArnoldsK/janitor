import fs from "node:fs"
import path from "node:path"

import { SlashCommandBuilder } from "discord.js"

import { appConfig } from "~/config"
import {
  Command,
  CommandSetup,
  makeVersionedDescription,
} from "~/utils/command"

const files = fs
  .readdirSync(__dirname)
  .filter((file) => file !== "index.ts" && file.endsWith(".ts"))

export const commands = new Map<string, Command>(
  files.map((file) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const setup = require(path.join(__dirname, file)).default as CommandSetup

    let name = path.basename(file, ".ts")
    if (appConfig.isDev) {
      name = `dev-${name}`
    }

    const data = setup
      .options(
        new SlashCommandBuilder()
          .setName(name)
          .setDescription(
            makeVersionedDescription(setup.description, setup.version),
          ),
      )
      .toJSON()

    const command: Command = {
      name,
      version: setup.version,
      permissions: setup.permissions,
      execute: setup.execute,
      data,
    }

    return [name, command]
  }),
)
