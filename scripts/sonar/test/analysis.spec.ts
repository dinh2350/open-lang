import { describe, expect, it } from 'vitest';
import { checkAnalysis } from '../analysis.ts';
import { FAKE_SONARQUBE_URL, startFakeSonarQube } from './fake-sonarqube.ts';
import { reportTaskFileFor } from './report-task-file.ts';

async function check(ceTaskId: string, token: string) {
  return checkAnalysis({
    hostUrl: FAKE_SONARQUBE_URL,
    token,
    reportTaskFile: reportTaskFileFor(ceTaskId),
    pollIntervalMs: 1,
  });
}

describe('pnpm sonar, after the scanner ran', () => {
  it('passes when the quality gate of its analysis passes', async () => {
    const sonarQube = startFakeSonarQube();
    const token = sonarQube.analysisToken();
    const { ceTaskId } = sonarQube.analyze({ gate: 'OK' });

    const result = await check(ceTaskId, token);

    expect(result.passed).toBe(true);
    expect(result.report).toContain('Quality gate passed');
  });

  it('waits until SonarQube has processed its analysis', async () => {
    const sonarQube = startFakeSonarQube();
    const { ceTaskId } = sonarQube.analyze({
      taskStatuses: ['PENDING', 'IN_PROGRESS', 'IN_PROGRESS', 'SUCCESS'],
      gate: 'ERROR',
      conditions: [coverageBelow80],
    });

    const result = await check(ceTaskId, sonarQube.analysisToken());

    expect(result.passed).toBe(false);
  });

  it('gives up when SonarQube never processes its analysis', async () => {
    const sonarQube = startFakeSonarQube();
    const { ceTaskId } = sonarQube.analyze({ taskStatuses: ['PENDING'] });

    await expect(
      checkAnalysis({
        hostUrl: FAKE_SONARQUBE_URL,
        token: sonarQube.analysisToken(),
        reportTaskFile: reportTaskFileFor(ceTaskId),
        pollIntervalMs: 1,
        timeoutMs: 50,
      }),
    ).rejects.toThrow(/SonarQube has not processed the analysis/);
  });

  it('reports why SonarQube could not process its analysis', async () => {
    const sonarQube = startFakeSonarQube();
    const { ceTaskId } = sonarQube.analyze({
      taskStatuses: ['IN_PROGRESS', 'FAILED'],
      taskErrorMessage: 'Unsupported report format',
    });

    await expect(check(ceTaskId, sonarQube.analysisToken())).rejects.toThrow(
      /SonarQube failed to process the analysis: Unsupported report format/,
    );
  });

  it('fails and lists each failed condition with its value and threshold', async () => {
    const sonarQube = startFakeSonarQube();
    const { ceTaskId } = sonarQube.analyze({
      gate: 'ERROR',
      conditions: [
        coverageBelow80,
        {
          status: 'OK',
          metricKey: 'duplicated_lines_density',
          comparator: 'GT',
          errorThreshold: '3',
          actualValue: '0.0',
        },
        {
          status: 'ERROR',
          metricKey: 'software_quality_maintainability_rating',
          comparator: 'GT',
          errorThreshold: '1',
          actualValue: '3',
        },
      ],
    });

    const result = await check(ceTaskId, sonarQube.analysisToken());

    expect(result.passed).toBe(false);
    expect(result.report).toContain('Quality gate FAILED');
    expect(result.report).toContain(
      '  coverage is 43.0, but must be at least 80',
    );
    expect(result.report).toContain(
      '  software_quality_maintainability_rating is C, but must be A',
    );
    expect(result.report).not.toContain('duplicated_lines_density');
  });

  it('lists every open issue with its file, line, rule and message', async () => {
    const sonarQube = startFakeSonarQube();
    const manyIssues = Array.from({ length: 501 }, (_, index) => ({
      file: 'backend/src/livekit/room-token.service.ts',
      line: index + 1,
      rule: 'typescript:S1854',
      message: 'Remove this useless assignment.',
    }));
    const { ceTaskId } = sonarQube.analyze({
      gate: 'ERROR',
      conditions: [maintainabilityRatingC],
      issues: [
        {
          file: 'agent/src/main.ts',
          line: 3,
          rule: 'typescript:S1128',
          message: "Remove this unused import of 'log'.",
        },
        {
          file: 'shared/src/index.ts',
          rule: 'typescript:S1192',
          message: 'Define a constant instead of duplicating this literal.',
        },
        ...manyIssues,
      ],
    });

    const result = await check(ceTaskId, sonarQube.analysisToken());

    expect(result.report).toContain('Open issues (503):');
    expect(result.report).toContain(
      "  agent/src/main.ts:3  typescript:S1128  Remove this unused import of 'log'.",
    );
    expect(result.report).toContain(
      '  shared/src/index.ts  typescript:S1192  Define a constant instead of duplicating this literal.',
    );
    expect(result.report).toContain(
      '  backend/src/livekit/room-token.service.ts:501  typescript:S1854  Remove this useless assignment.',
    );
  });

  it('lists every Security Hotspot to review, and says that only a human may mark one as safe', async () => {
    const sonarQube = startFakeSonarQube();
    const { ceTaskId } = sonarQube.analyze({
      gate: 'ERROR',
      conditions: [
        {
          status: 'ERROR',
          metricKey: 'security_hotspots_reviewed',
          comparator: 'LT',
          errorThreshold: '100',
          actualValue: '0.0',
        },
      ],
      hotspots: [
        {
          file: 'frontend/vite.config.ts',
          line: 19,
          rule: 'typescript:S5332',
          message: 'Make sure that using clear-text protocols is safe here.',
        },
      ],
    });

    const result = await check(ceTaskId, sonarQube.analysisToken());

    expect(result.report).toContain('Security Hotspots to review (1):');
    expect(result.report).toContain(
      '  frontend/vite.config.ts:19  typescript:S5332  Make sure that using clear-text protocols is safe here.',
    );
    expect(result.report).toContain(
      'Only a human may mark a Security Hotspot as safe',
    );
  });

  it("judges its own analysis even when another checkout's scan finished later", async () => {
    const sonarQube = startFakeSonarQube();
    const ours = sonarQube.analyze({
      gate: 'ERROR',
      conditions: [coverageBelow80],
    });
    sonarQube.analyze({ gate: 'OK' });

    const result = await check(ours.ceTaskId, sonarQube.analysisToken());

    expect(result.passed).toBe(false);
    expect(result.report).toContain(
      'Another scan of open-lang finished after this one',
    );
  });

  it('lists the files with the most uncovered lines when coverage fails', async () => {
    const sonarQube = startFakeSonarQube();
    const { ceTaskId } = sonarQube.analyze({
      gate: 'ERROR',
      conditions: [coverageBelow80],
      files: [
        {
          path: 'frontend/src/main.tsx',
          measures: { coverage: '0.0', uncovered_lines: '5' },
        },
        {
          path: 'backend/src/main.ts',
          measures: { coverage: '0.0', uncovered_lines: '9' },
        },
        {
          path: 'shared/src/room-token.ts',
          measures: { coverage: '100.0', uncovered_lines: '0' },
        },
      ],
    });

    const result = await check(ceTaskId, sonarQube.analysisToken());

    expect(result.report).toContain(
      [
        'Files with the most uncovered lines:',
        '  backend/src/main.ts  9 uncovered lines, 0.0% coverage',
        '  frontend/src/main.tsx  5 uncovered lines, 0.0% coverage',
      ].join('\n'),
    );
    expect(result.report).not.toContain('shared/src/room-token.ts');
  });

  it('lists the files with the most duplicated lines when duplication fails', async () => {
    const sonarQube = startFakeSonarQube();
    const { ceTaskId } = sonarQube.analyze({
      gate: 'ERROR',
      conditions: [
        {
          status: 'ERROR',
          metricKey: 'duplicated_lines_density',
          comparator: 'GT',
          errorThreshold: '3',
          actualValue: '7.5',
        },
      ],
      files: [
        {
          path: 'backend/src/livekit/room-token.service.ts',
          measures: {
            duplicated_lines: '12',
            duplicated_lines_density: '30.0',
          },
        },
      ],
    });

    const result = await check(ceTaskId, sonarQube.analysisToken());

    expect(result.report).toContain(
      [
        'Files with the most duplicated lines:',
        '  backend/src/livekit/room-token.service.ts  12 duplicated lines, 30.0% duplicated',
      ].join('\n'),
    );
  });

  it('lists open issues even when the quality gate passes', async () => {
    const sonarQube = startFakeSonarQube();
    const { ceTaskId } = sonarQube.analyze({
      gate: 'OK',
      issues: [
        {
          file: 'agent/src/main.ts',
          line: 3,
          rule: 'typescript:S1128',
          message: "Remove this unused import of 'log'.",
        },
      ],
    });

    const result = await check(ceTaskId, sonarQube.analysisToken());

    expect(result.passed).toBe(true);
    expect(result.report).toContain(
      "  agent/src/main.ts:3  typescript:S1128  Remove this unused import of 'log'.",
    );
  });
});

const maintainabilityRatingC = {
  status: 'ERROR',
  metricKey: 'software_quality_maintainability_rating',
  comparator: 'GT',
  errorThreshold: '1',
  actualValue: '3',
} as const;

const coverageBelow80 = {
  status: 'ERROR',
  metricKey: 'coverage',
  comparator: 'LT',
  errorThreshold: '80',
  actualValue: '43.0',
} as const;
