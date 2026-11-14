import { describe, expect, it } from 'vitest';
import { assertReadyToScan } from '../scan.ts';
import { FAKE_SONARQUBE_URL, startFakeSonarQube } from './fake-sonarqube.ts';

describe('pnpm sonar, before it runs the tests and the scanner', () => {
  it('says to run sonar:setup when the checkout has no SONAR_TOKEN', async () => {
    startFakeSonarQube();

    await expect(
      assertReadyToScan({ hostUrl: FAKE_SONARQUBE_URL, token: undefined }),
    ).rejects.toThrow(
      /SONAR_TOKEN is not set[\s\S]*`pnpm sonar:up`, then `pnpm sonar:setup`/,
    );
  });

  it('says to run sonar:setup when SonarQube rejects SONAR_TOKEN', async () => {
    startFakeSonarQube();

    await expect(
      assertReadyToScan({
        hostUrl: FAKE_SONARQUBE_URL,
        token: 'squ_revoked-token',
      }),
    ).rejects.toThrow(/SonarQube rejects SONAR_TOKEN[\s\S]*`pnpm sonar:setup`/);
  });

  it('says to run sonar:up when SonarQube is not running', async () => {
    await expect(
      assertReadyToScan({ hostUrl: 'http://127.0.0.1:9', token: 'squ_any' }),
    ).rejects.toThrow(
      /isn't reachable at http:\/\/127\.0\.0\.1:9[\s\S]*`pnpm sonar:up`/,
    );
  });

  it('accepts a valid SONAR_TOKEN', async () => {
    const sonarQube = startFakeSonarQube();

    await expect(
      assertReadyToScan({
        hostUrl: FAKE_SONARQUBE_URL,
        token: sonarQube.analysisToken(),
      }),
    ).resolves.toBeUndefined();
  });
});
