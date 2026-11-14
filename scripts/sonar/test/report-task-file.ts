import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { onTestFinished } from 'vitest';
import { FAKE_SONARQUBE_URL } from './fake-sonarqube.ts';

/**
 * The scanner's report of the analysis it submitted, as the
 * `report-task.txt` it writes to its working directory.
 */
export function reportTaskFileFor(ceTaskId: string): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'sonar-scan-'));
  onTestFinished(() => {
    rmSync(directory, { recursive: true });
  });
  const reportTaskFile = path.join(directory, 'report-task.txt');
  writeFileSync(
    reportTaskFile,
    [
      'projectKey=livekit-platform',
      `serverUrl=${FAKE_SONARQUBE_URL}`,
      'serverVersion=26.11.0.134175',
      `dashboardUrl=${FAKE_SONARQUBE_URL}/dashboard?id=livekit-platform`,
      `ceTaskId=${ceTaskId}`,
      `ceTaskUrl=${FAKE_SONARQUBE_URL}/api/ce/task?id=${ceTaskId}`,
      '',
    ].join('\n'),
  );
  return reportTaskFile;
}
