import { z } from 'zod';

/**
 * Validates part of the backend's environment at startup. On failure it
 * throws an error that names `settings` and every bad variable.
 */
export function parseEnv<Schema extends z.ZodType>(
  settings: string,
  schema: Schema,
  env: NodeJS.ProcessEnv,
): z.infer<Schema> {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new Error(
      `Invalid ${settings} settings in the backend environment:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
