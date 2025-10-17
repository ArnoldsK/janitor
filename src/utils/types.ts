export const isNonNullish = <T>(entry: T | null | undefined): entry is T =>
  entry !== null && entry !== undefined
