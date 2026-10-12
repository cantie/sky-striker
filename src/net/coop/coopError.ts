/** Why the last co-op attempt ended badly (connection lost, refused…), shown once by the lobby. */
let last: string | null = null
export const setCoopError = (msg: string | null) => { last = msg }
export function takeCoopError(): string | null {
  const m = last
  last = null
  return m
}
