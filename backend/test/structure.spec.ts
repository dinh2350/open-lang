import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceDirectory = path.resolve(import.meta.dirname, '..', 'src');

interface SourceFile {
  /** Relative to `backend/src`, with `/` separators. */
  readonly path: string;
  readonly text: string;
}

/** Every `.ts` file of the backend's source, except the generated Prisma client. */
function sourceFiles(): SourceFile[] {
  return readdirSync(sourceDirectory, { recursive: true, encoding: 'utf8' })
    .map((file) => file.split(path.sep).join('/'))
    .filter((file) => file.endsWith('.ts') && !file.startsWith('generated/'))
    .map((file) => ({
      path: file,
      text: readFileSync(path.join(sourceDirectory, file), 'utf8'),
    }));
}

describe('The backend source layout', () => {
  it('spells the API prefix and the auth path only in routes.ts', () => {
    const offenders = sourceFiles()
      .filter(
        ({ path: file, text }) =>
          file !== 'routes.ts' && /['"`]\/?api(\/|['"`])/.test(text),
      )
      .map(({ path: file }) => file);

    expect(offenders).toEqual([]);
  });
});
