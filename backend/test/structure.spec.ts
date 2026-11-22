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

/** The paths of the source files whose text contains `needle`. */
function filesContaining(needle: string): string[] {
  return sourceFiles()
    .filter(({ text }) => text.includes(needle))
    .map(({ path: file }) => file);
}

/** The paths of the source files whose text matches `pattern`. */
function filesMatching(pattern: RegExp): string[] {
  return sourceFiles()
    .filter(({ text }) => pattern.test(text))
    .map(({ path: file }) => file);
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

  it('keeps the auth guards, decorators and exceptions in folders of their own', () => {
    const homes = [
      ['.guard.ts', 'auth/guards/'],
      ['.decorator.ts', 'auth/decorators/'],
      ['.exception.ts', 'auth/exceptions/'],
    ] as const;
    const files = sourceFiles().map(({ path: file }) => file);

    const misplaced = files.filter((file) =>
      homes.some(
        ([suffix, folder]) => file.endsWith(suffix) && !file.startsWith(folder),
      ),
    );

    expect(misplaced).toEqual([]);
    expect(files).toEqual(
      expect.arrayContaining([
        'auth/guards/authentication.guard.ts',
        'auth/guards/role.guard.ts',
        'auth/decorators/public.decorator.ts',
        'auth/decorators/current-user.decorator.ts',
        'auth/decorators/admin-only.decorator.ts',
        'auth/exceptions/account-locked.exception.ts',
      ]),
    );
  });

  it('registers the throttler only in AppModule', () => {
    expect(filesContaining('ThrottlerModule.forRoot')).toEqual([
      'app.module.ts',
    ]);
  });

  it('declares the authenticated request type once', () => {
    expect(filesContaining('interface AuthenticatedRequest')).toEqual([
      'auth/authenticated-request.ts',
    ]);
    expect(filesContaining('Request & {')).toEqual([]);
  });

  it('declares the auth request types outside the service', () => {
    expect(filesContaining('export type ValidRegisterRequest')).toEqual([
      'auth/auth.types.ts',
    ]);
  });

  it('lets only UsersService read and write the User table', () => {
    expect(filesMatching(/\b(prisma|transaction)\.user\./)).toEqual([
      'users/users.service.ts',
    ]);
    expect(sourceFiles().map(({ path: file }) => file)).not.toContain(
      'auth/users.ts',
    );
  });

  it('has no global module', () => {
    expect(filesContaining('@Global(')).toEqual([]);
  });

  it('keeps shared test helpers in test/support, not loose in test/', () => {
    const loose = readdirSync(import.meta.dirname, { withFileTypes: true })
      .filter((entry) => entry.isFile() && !entry.name.endsWith('.spec.ts'))
      .map((entry) => entry.name);

    expect(loose).toEqual([]);
  });

  it('keeps the modules free of cycles', () => {
    const files = sourceFiles();
    const importsOf = (folder: string, pattern: RegExp) =>
      files
        .filter(
          ({ path: file, text }) =>
            file.startsWith(folder) && pattern.test(text),
        )
        .map(({ path: file }) => file);

    expect(files.map(({ path: file }) => file)).toContain(
      'refresh-tokens/refresh-token.service.ts',
    );
    expect(importsOf('refresh-tokens/', /from '\.\.\/(auth|users)\//)).toEqual(
      [],
    );
    expect(importsOf('users/users.module.ts', /auth\.module/)).toEqual([]);
    expect(importsOf('auth/', /prisma\.service/)).toEqual([]);
  });
});
