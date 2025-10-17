import { Context } from "~/types"

export interface CronTask {
  expression: string
  productionOnly: boolean
  execute: (context: Context) => Promise<void>
}
