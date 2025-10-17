import { CronTask } from "~/types"

export default {
  // expression: "0 * * * *", // Every hour
  expression: "* * * * *", // Every minute

  // productionOnly: true,
  productionOnly: false,

  execute: async (_context) => {
    // ...
    console.log("I be running")
  },
} satisfies CronTask
