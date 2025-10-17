export const assertUnreachable = (_arg: never): void => {
  throw new Error("Argument should be unreachable")
}
