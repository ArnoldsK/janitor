import { readdirSync } from "node:fs"
import path from "node:path"

import { isNonNullish } from "~/utils/types"

const getImportableDirectoryFiles = (dir: string) => {
  return readdirSync(dir)
    .filter(
      (file) =>
        (file.endsWith(".ts") || file.endsWith(".js")) &&
        !file.startsWith("index"),
    )
    .map((file) => path.join(dir, file.replace(/\.(t|s)s$/, "")))
}

/**
 * Import and return all directory file `default` exports.
 *
 * For use in index files. Index files are excluded from the import.
 *
 * @example
 * ```ts
 * import { importDirectoryDefaults } from "~/server/utils/utils/file"
 *
 * export const getRoutes = () => importDirectoryDefaults<Route>(__dirname)
 * ```
 */
export const importDirectoryDefaults = async <TDefault>(
  dir: string,
  ...paths: string[]
): Promise<Map<string, TDefault>> => {
  const files = getImportableDirectoryFiles(path.join(dir, ...paths))
  const imports = await Promise.all(
    files.map(async (file) => {
      try {
        const imported = await import(file)
        return [
          path.basename(file, ".ts"),
          imported.default as TDefault,
        ] as const
      } catch (error) {
        console.error(`Error importing file ${file}:`, error)
        return null
      }
    }),
  )

  return new Map(imports.filter(isNonNullish))
}
