/** The message of an error, for a log line; anything else thrown, as text. */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
