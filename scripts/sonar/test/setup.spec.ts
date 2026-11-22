import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, onTestFinished } from 'vitest';
import { checkAnalysis } from '../analysis.ts';
import { setUpSonarQube } from '../setup.ts';
import { FAKE_SONARQUBE_URL, startFakeSonarQube } from './fake-sonarqube.ts';
import { reportTaskFileFor } from './report-task-file.ts';

const ADMIN_PASSWORD = 'Local-Sonar-Admin-1';

/**
 * The ticket's gate on overall code, sorted by metric: coverage of at least
 * 80%, at most 3% duplicated lines, all hotspots reviewed, and A ratings
 * (a rating above 1 is worse than A).
 */
const GATE_CONDITIONS = [
  { metric: 'coverage', op: 'LT', error: '80' },
  { metric: 'duplicated_lines_density', op: 'GT', error: '3' },
  { metric: 'security_hotspots_reviewed', op: 'LT', error: '100' },
  { metric: 'software_quality_maintainability_rating', op: 'GT', error: '1' },
  { metric: 'software_quality_reliability_rating', op: 'GT', error: '1' },
  { metric: 'software_quality_security_rating', op: 'GT', error: '1' },
];

/** A checkout's git-ignored env file, in a temporary directory. */
function envFileWith(content: string): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'sonar-setup-'));
  onTestFinished(() => {
    rmSync(directory, { recursive: true });
  });
  const envFile = path.join(directory, '.env');
  writeFileSync(envFile, content);
  return envFile;
}

function sonarTokenIn(envFile: string): string | undefined {
  return /^SONAR_TOKEN=(.*)$/m.exec(readFileSync(envFile, 'utf8'))?.[1];
}

function setUp({
  envFile = envFileWith(''),
  tokenName = 'open-lang checkout-a',
} = {}) {
  return setUpSonarQube({
    hostUrl: FAKE_SONARQUBE_URL,
    adminPassword: ADMIN_PASSWORD,
    envFile,
    tokenName,
    log: () => undefined,
  });
}

describe('pnpm sonar:setup', () => {
  it('changes the default admin password to SONAR_ADMIN_PASSWORD', async () => {
    const sonarQube = startFakeSonarQube();

    await setUp();

    expect(sonarQube.acceptsAdminPassword(ADMIN_PASSWORD)).toBe(true);
    expect(sonarQube.acceptsAdminPassword('admin')).toBe(false);
  });

  it('keeps the admin password when an earlier run already set it', async () => {
    const sonarQube = startFakeSonarQube();
    await setUp();

    await setUp();

    expect(sonarQube.acceptsAdminPassword(ADMIN_PASSWORD)).toBe(true);
  });

  it('creates the open-lang project once', async () => {
    const sonarQube = startFakeSonarQube();

    await setUp();
    await setUp();

    expect(sonarQube.projects()).toEqual([
      { key: 'open-lang', name: 'Open Lang' },
    ]);
  });

  it('creates the Open Lang Gate on overall code and makes it the default', async () => {
    const sonarQube = startFakeSonarQube();

    await setUp();

    expect(sonarQube.defaultQualityGate()).toEqual({
      name: 'Open Lang Gate',
      conditions: GATE_CONDITIONS,
    });
  });

  it('restores the Open Lang Gate when its conditions were changed', async () => {
    const sonarQube = startFakeSonarQube();
    await setUp();
    sonarQube.changeQualityGate('Open Lang Gate', (conditions) => [
      ...conditions
        .filter((condition) => condition.metric !== 'coverage')
        .map((condition) =>
          condition.metric === 'duplicated_lines_density'
            ? { ...condition, error: '10' }
            : condition,
        ),
      { metric: 'new_violations', op: 'GT', error: '0' },
    ]);
    sonarQube.setDefaultQualityGate('Sonar way');

    await setUp();

    expect(sonarQube.defaultQualityGate()).toEqual({
      name: 'Open Lang Gate',
      conditions: GATE_CONDITIONS,
    });
  });

  it("writes a new analysis token for the checkout to its env file as SONAR_TOKEN, keeping the file's other lines", async () => {
    const sonarQube = startFakeSonarQube();
    const envFile = envFileWith(
      `# Local SonarQube\nSONAR_ADMIN_PASSWORD=${ADMIN_PASSWORD}\n`,
    );

    await setUp({ envFile, tokenName: 'open-lang checkout-a' });

    const token = sonarTokenIn(envFile) ?? '';
    expect(sonarQube.analysisTokenNamed(token)).toBe('open-lang checkout-a');
    expect(readFileSync(envFile, 'utf8')).toBe(
      `# Local SonarQube\nSONAR_ADMIN_PASSWORD=${ADMIN_PASSWORD}\nSONAR_TOKEN=${token}\n`,
    );
  });

  it('writes a SONAR_TOKEN that can read everything `pnpm sonar` reports', async () => {
    const sonarQube = startFakeSonarQube();
    const envFile = envFileWith('');
    await setUp({ envFile });
    const { ceTaskId } = sonarQube.analyze({ gate: 'OK' });

    const result = await checkAnalysis({
      hostUrl: FAKE_SONARQUBE_URL,
      token: sonarTokenIn(envFile) ?? '',
      reportTaskFile: reportTaskFileFor(ceTaskId),
    });

    expect(result.passed).toBe(true);
  });

  it("replaces the checkout's token on a rerun and revokes the old one", async () => {
    const sonarQube = startFakeSonarQube();
    const envFile = envFileWith('');
    await setUp({ envFile });
    const oldToken = sonarTokenIn(envFile) ?? '';

    await setUp({ envFile });

    const newToken = sonarTokenIn(envFile) ?? '';
    expect(newToken).not.toBe(oldToken);
    expect(sonarQube.analysisTokenNamed(newToken)).toBe('open-lang checkout-a');
    expect(sonarQube.analysisTokenNamed(oldToken)).toBeUndefined();
    expect(readFileSync(envFile, 'utf8')).toBe(`SONAR_TOKEN=${newToken}\n`);
  });

  it("leaves other checkouts' tokens valid", async () => {
    const sonarQube = startFakeSonarQube();
    const otherEnvFile = envFileWith('');
    await setUp({
      envFile: otherEnvFile,
      tokenName: 'open-lang checkout-b',
    });

    await setUp({ tokenName: 'open-lang checkout-a' });

    expect(sonarQube.analysisTokenNamed(sonarTokenIn(otherEnvFile) ?? '')).toBe(
      'open-lang checkout-b',
    );
  });

  it('explains what to do when SonarQube rejects SONAR_ADMIN_PASSWORD', async () => {
    startFakeSonarQube({ adminPassword: 'Another-Admin-Password-1' });

    await expect(setUp()).rejects.toThrow(
      /Set SONAR_ADMIN_PASSWORD in \.env to the password an earlier `pnpm sonar:setup` set/,
    );
  });
});
