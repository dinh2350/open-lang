import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Keeps `value` as `<name>.json` next to the run's evidence, for a human to
 * read: in E2E_EVIDENCE_DIR (relative to the repository root), when it is set.
 * Does nothing otherwise. Writing again under the same name replaces the file.
 * Never put a password, a token or a key in `value`.
 */
export async function saveLog(name: string, value: unknown): Promise<void> {
  const evidence = process.env.E2E_EVIDENCE_DIR;
  if (evidence === undefined) {
    return;
  }
  const directory = path.resolve(import.meta.dirname, '..', '..', evidence);
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, `${name}.json`),
    `${JSON.stringify(value, null, 2)}\n`,
  );
}
