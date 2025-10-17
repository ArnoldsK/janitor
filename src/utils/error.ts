export function assert(condition: boolean, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg ?? "Unable to handle data")
  }
}

export const assertUnreachable = (_arg: never): void => {
  throw new Error("Argument should be unreachable")
}

export const checkUnreachable = (_arg: never): void => {}
