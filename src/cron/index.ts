import { CronTask } from "~/types"
import { importDirectoryDefaults } from "~/utils/file"

export const getCronTasks = () =>
  importDirectoryDefaults<CronTask>(__dirname, "tasks")
