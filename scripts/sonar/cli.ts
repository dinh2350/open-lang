// Entry point of the `sonar:setup` and `sonar` scripts. Run it with the
// checkout's git-ignored .env loaded: `node --env-file-if-exists=.env`.
//
//   setup      configure SonarQube and write this checkout's SONAR_TOKEN
//   preflight  fail fast, before the tests run, when this checkout can't scan
//   scan       run the scanner and report the quality gate of its analysis
import { createHash } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import { assertReadyToScan, scanRepo } from './scan.ts';
import { setUpSonarQube } from './setup.ts';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

const environment = z
  .object({
    SONAR_HOST_URL: z.url().default('http://localhost:9000'),
    SONAR_ADMIN_PASSWORD: z.string().optional(),
    SONAR_TOKEN: z.string().optional(),
  })
  .parse(process.env);

/** Unique per checkout, and recognizable in SonarQube's token list. */
function analysisTokenName(): string {
  const pathHash = createHash('sha256')
    .update(repoRoot)
    .digest('hex')
    .slice(0, 8);
  return `livekit-platform scan ${path.basename(repoRoot).slice(0, 40)} ${pathHash}`;
}

async function setup(): Promise<void> {
  if (!environment.SONAR_ADMIN_PASSWORD) {
    throw new Error(
      'SONAR_ADMIN_PASSWORD is not set. Copy .env.example to .env (it has a local default) and run `pnpm sonar:setup` again.',
    );
  }
  await setUpSonarQube({
    hostUrl: environment.SONAR_HOST_URL,
    adminPassword: environment.SONAR_ADMIN_PASSWORD,
    envFile: path.join(repoRoot, '.env'),
    tokenName: analysisTokenName(),
    log: (message) => {
      console.log(message);
    },
  });
}

async function scan(): Promise<boolean> {
  const result = await scanRepo({
    hostUrl: environment.SONAR_HOST_URL,
    token: environment.SONAR_TOKEN,
    repoRoot,
  });
  console.log(`\n${result.report}`);
  return result.passed;
}

async function run(command: string | undefined): Promise<boolean> {
  switch (command) {
    case 'setup':
      await setup();
      return true;
    case 'preflight':
      await assertReadyToScan({
        hostUrl: environment.SONAR_HOST_URL,
        token: environment.SONAR_TOKEN,
      });
      return true;
    case 'scan':
      return scan();
    default:
      throw new Error(
        `Unknown command "${command ?? ''}". Use setup, preflight or scan.`,
      );
  }
}

try {
  process.exitCode = (await run(process.argv[2])) ? 0 : 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
