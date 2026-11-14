// `pnpm sonar`: checks that this checkout can scan, then (after `pnpm test`
// wrote the lcov reports) runs the scanner and reports the quality gate of
// the analysis it submitted.
import path from 'node:path';
import { scan } from '@sonar/scan';
import { z } from 'zod';
import { type AnalysisResult, checkAnalysis } from './analysis.ts';
import { SONAR_PROJECT } from './project.ts';
import { SonarQube } from './sonarqube.ts';

export interface ScanSettings {
  readonly hostUrl: string;
  /** `SONAR_TOKEN` from the checkout's git-ignored `.env`, if set. */
  readonly token: string | undefined;
}

const validationSchema = z.object({ valid: z.boolean() });

/** Fails with what to do next when this checkout can't scan yet. */
export async function assertReadyToScan(settings: ScanSettings): Promise<void> {
  if (!settings.token) {
    throw new Error(
      'SONAR_TOKEN is not set in this checkout’s .env. Each checkout has its own analysis token: ' +
        'run `pnpm sonar:up`, then `pnpm sonar:setup`, which writes SONAR_TOKEN to .env.',
    );
  }
  const sonarQube = new SonarQube(settings.hostUrl, { token: settings.token });
  const { valid } = await sonarQube.get(
    'authentication/validate',
    {},
    validationSchema,
  );
  if (!valid) {
    throw new Error(
      'SonarQube rejects SONAR_TOKEN: it was revoked, or SonarQube was reset. ' +
        'Run `pnpm sonar:setup` to write a new one to .env.',
    );
  }
}

/** Scans the repo and checks the quality gate of the analysis it submitted. */
export async function scanRepo(
  settings: ScanSettings & { readonly repoRoot: string },
): Promise<AnalysisResult> {
  await assertReadyToScan(settings);
  const token = settings.token ?? '';
  const workingDirectory = path.join(settings.repoRoot, '.scannerwork');
  await scan({
    serverUrl: settings.hostUrl,
    token,
    options: {
      'sonar.projectBaseDir': settings.repoRoot,
      'sonar.projectKey': SONAR_PROJECT.key,
      'sonar.projectName': SONAR_PROJECT.name,
      'sonar.working.directory': workingDirectory,
    },
  });
  return checkAnalysis({
    hostUrl: settings.hostUrl,
    token,
    reportTaskFile: path.join(workingDirectory, 'report-task.txt'),
  });
}
