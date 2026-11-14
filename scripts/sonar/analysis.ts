// The second half of `pnpm sonar`: after the scanner submitted its report,
// wait for SonarQube to process that analysis and report its quality gate.
// Several checkouts scan into the same project, so everything is looked up
// through this scan's own task and analysis ids.
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { SonarQube } from './sonarqube.ts';

export interface AnalysisCheck {
  readonly hostUrl: string;
  readonly token: string;
  /** `report-task.txt`, which the scanner writes after submitting its report. */
  readonly reportTaskFile: string;
  readonly pollIntervalMs?: number;
  /** How long to wait for SonarQube to process the analysis. */
  readonly timeoutMs?: number;
}

const TEN_MINUTES_IN_MS = 10 * 60 * 1000;

export interface AnalysisResult {
  readonly passed: boolean;
  readonly report: string;
}

const reportTaskSchema = z.object({
  projectKey: z.string().min(1),
  ceTaskId: z.string().min(1),
  dashboardUrl: z.string().optional(),
});

function readReportTask(reportTaskFile: string) {
  const properties = Object.fromEntries(
    readFileSync(reportTaskFile, 'utf8')
      .split('\n')
      .map((line) => /^([^=]+)=(.*)$/.exec(line.trim()))
      .filter((match) => match !== null)
      .map(([, key, value]) => [key, value]),
  );
  return reportTaskSchema.parse(properties);
}

const ceTaskSchema = z.object({
  task: z.object({
    status: z.enum(['PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED', 'CANCELED']),
    analysisId: z.string().optional(),
    errorMessage: z.string().optional(),
  }),
});

async function processedAnalysisId(
  sonarQube: SonarQube,
  ceTaskId: string,
  { pollIntervalMs, timeoutMs }: { pollIntervalMs: number; timeoutMs: number },
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { task } = await sonarQube.get(
      'ce/task',
      { id: ceTaskId },
      ceTaskSchema,
    );
    if (task.status === 'SUCCESS' && task.analysisId) {
      return task.analysisId;
    }
    if (task.status === 'FAILED' || task.status === 'CANCELED') {
      throw new Error(
        `SonarQube failed to process the analysis: ${task.errorMessage ?? task.status}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error(
    `SonarQube has not processed the analysis (task ${ceTaskId}) after ${String(timeoutMs / 1000)} s. ` +
      'See its background tasks at /admin/background_tasks.',
  );
}

const projectStatusSchema = z.object({
  projectStatus: z.object({
    status: z.string(),
    conditions: z
      .array(
        z.object({
          status: z.string(),
          metricKey: z.string(),
          comparator: z.enum(['GT', 'LT']),
          errorThreshold: z.string(),
          actualValue: z.string().optional(),
        }),
      )
      .default([]),
  }),
});

type ConditionStatus = z.infer<
  typeof projectStatusSchema
>['projectStatus']['conditions'][number];

const RATING_LETTERS = ['A', 'B', 'C', 'D', 'E'];

function describeFailedCondition(condition: ConditionStatus): string {
  const {
    metricKey,
    comparator,
    errorThreshold,
    actualValue = '?',
  } = condition;
  if (metricKey.endsWith('_rating')) {
    const letter = (value: string) =>
      RATING_LETTERS[Number(value) - 1] ?? value;
    const best = errorThreshold === '1' ? '' : ' or better';
    return `${metricKey} is ${letter(actualValue)}, but must be ${letter(errorThreshold)}${best}`;
  }
  const bound = comparator === 'LT' ? 'at least' : 'at most';
  return `${metricKey} is ${actualValue}, but must be ${bound} ${errorThreshold}`;
}

const PAGE_SIZE = 500;

const pagingSchema = z.object({
  paging: z.object({ pageIndex: z.number(), total: z.number() }),
});

/** Fetches every page of a paged Web API search. */
async function allPages<T>(
  fetchPage: (page: number) => Promise<{ items: T[]; total: number }>,
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const result = await fetchPage(page);
    items.push(...result.items);
    if (result.items.length === 0 || items.length >= result.total) {
      return items;
    }
  }
}

/** A finding at a place in the code: an issue or a Security Hotspot. */
interface Finding {
  readonly file: string;
  readonly line?: number;
  readonly rule: string;
  readonly message: string;
}

/** `<projectKey>:path/to/file.ts` → `path/to/file.ts` */
function filePath(projectKey: string, componentKey: string): string {
  const prefix = `${projectKey}:`;
  return componentKey.startsWith(prefix)
    ? componentKey.slice(prefix.length)
    : componentKey;
}

const issuesSchema = pagingSchema.extend({
  issues: z.array(
    z.object({
      component: z.string(),
      line: z.number().optional(),
      rule: z.string(),
      message: z.string(),
    }),
  ),
});

function openIssues(
  sonarQube: SonarQube,
  projectKey: string,
): Promise<Finding[]> {
  return allPages(async (page) => {
    const { paging, issues } = await sonarQube.get(
      'issues/search',
      { components: projectKey, resolved: 'false', ps: PAGE_SIZE, p: page },
      issuesSchema,
    );
    return {
      total: paging.total,
      items: issues.map((issue) => ({
        file: filePath(projectKey, issue.component),
        line: issue.line,
        rule: issue.rule,
        message: issue.message,
      })),
    };
  });
}

const hotspotsSchema = pagingSchema.extend({
  hotspots: z.array(
    z.object({
      component: z.string(),
      line: z.number().optional(),
      ruleKey: z.string(),
      message: z.string(),
    }),
  ),
});

function hotspotsToReview(
  sonarQube: SonarQube,
  projectKey: string,
): Promise<Finding[]> {
  return allPages(async (page) => {
    const { paging, hotspots } = await sonarQube.get(
      'hotspots/search',
      { project: projectKey, status: 'TO_REVIEW', ps: PAGE_SIZE, p: page },
      hotspotsSchema,
    );
    return {
      total: paging.total,
      items: hotspots.map((hotspot) => ({
        file: filePath(projectKey, hotspot.component),
        line: hotspot.line,
        rule: hotspot.ruleKey,
        message: hotspot.message,
      })),
    };
  });
}

function describeFinding({ file, line, rule, message }: Finding): string {
  const place = line === undefined ? file : `${file}:${String(line)}`;
  return `  ${place}  ${rule}  ${message}`;
}

const analysesSchema = z.object({
  analyses: z.array(z.object({ key: z.string() })),
});

/**
 * Issues, hotspots and file measures belong to the project's latest
 * analysis. When another checkout's scan finished after this one, they
 * describe that scan instead.
 */
async function isLatestAnalysis(
  sonarQube: SonarQube,
  projectKey: string,
  analysisId: string,
): Promise<boolean> {
  const { analyses } = await sonarQube.get(
    'project_analyses/search',
    { project: projectKey, ps: 1 },
    analysesSchema,
  );
  return analyses[0]?.key === analysisId;
}

const componentTreeSchema = z.object({
  components: z.array(
    z.object({
      path: z.string(),
      measures: z.array(z.object({ metric: z.string(), value: z.string() })),
    }),
  ),
});

const WORST_FILES_SHOWN = 10;

/** The files with the highest value of `countMetric`, worst first. */
async function worstFiles(
  sonarQube: SonarQube,
  projectKey: string,
  countMetric: string,
  densityMetric: string,
): Promise<{ path: string; count: string; density: string }[]> {
  const { components } = await sonarQube.get(
    'measures/component_tree',
    {
      component: projectKey,
      qualifiers: 'FIL',
      metricKeys: `${countMetric},${densityMetric}`,
      s: 'metric',
      metricSort: countMetric,
      metricSortFilter: 'withMeasuresOnly',
      asc: 'false',
      ps: WORST_FILES_SHOWN,
    },
    componentTreeSchema,
  );
  return components
    .map((file) => {
      const measure = (metric: string) =>
        file.measures.find((m) => m.metric === metric)?.value ?? '?';
      return {
        path: file.path,
        count: measure(countMetric),
        density: measure(densityMetric),
      };
    })
    .filter((file) => Number(file.count) > 0);
}

export async function checkAnalysis(
  check: AnalysisCheck,
): Promise<AnalysisResult> {
  const sonarQube = new SonarQube(check.hostUrl, { token: check.token });
  const { projectKey, ceTaskId, dashboardUrl } = readReportTask(
    check.reportTaskFile,
  );
  const analysisId = await processedAnalysisId(sonarQube, ceTaskId, {
    pollIntervalMs: check.pollIntervalMs ?? 1000,
    timeoutMs: check.timeoutMs ?? TEN_MINUTES_IN_MS,
  });
  const { projectStatus } = await sonarQube.get(
    'qualitygates/project_status',
    { analysisId },
    projectStatusSchema,
  );
  const passed = projectStatus.status === 'OK';
  const failedConditions = projectStatus.conditions.filter(
    (condition) => condition.status === 'ERROR',
  );
  const failedMetric = (metric: string) =>
    failedConditions.some((condition) => condition.metricKey === metric);

  const lines: string[] = [];
  if (!(await isLatestAnalysis(sonarQube, projectKey, analysisId))) {
    lines.push(
      `Warning: Another scan of ${projectKey} finished after this one, probably from another checkout. ` +
        'The quality gate below is this scan’s own, but the issues, hotspots and files listed come from the latest scan. Rerun `pnpm sonar` for an exact list.',
      '',
    );
  }
  if (passed) {
    lines.push('Quality gate passed.');
  } else {
    lines.push('Quality gate FAILED. Failed conditions:');
    lines.push(
      ...failedConditions.map(
        (condition) => `  ${describeFailedCondition(condition)}`,
      ),
    );
  }

  if (failedMetric('coverage')) {
    const files = await worstFiles(
      sonarQube,
      projectKey,
      'uncovered_lines',
      'coverage',
    );
    lines.push('', 'Files with the most uncovered lines:');
    lines.push(
      ...files.map(
        (file) =>
          `  ${file.path}  ${file.count} uncovered lines, ${file.density}% coverage`,
      ),
    );
  }
  if (failedMetric('duplicated_lines_density')) {
    const files = await worstFiles(
      sonarQube,
      projectKey,
      'duplicated_lines',
      'duplicated_lines_density',
    );
    lines.push('', 'Files with the most duplicated lines:');
    lines.push(
      ...files.map(
        (file) =>
          `  ${file.path}  ${file.count} duplicated lines, ${file.density}% duplicated`,
      ),
    );
  }

  const issues = await openIssues(sonarQube, projectKey);
  if (issues.length > 0) {
    lines.push('', `Open issues (${String(issues.length)}):`);
    lines.push(...issues.map(describeFinding));
  }
  const hotspots = await hotspotsToReview(sonarQube, projectKey);
  if (hotspots.length > 0) {
    lines.push('', `Security Hotspots to review (${String(hotspots.length)}):`);
    lines.push(...hotspots.map(describeFinding));
    lines.push(
      'Only a human may mark a Security Hotspot as safe. Fix the code, or list the hotspot under `## Comments` in the ticket for a human to review.',
    );
  }
  if (dashboardUrl) {
    lines.push('', `Dashboard: ${dashboardUrl}`);
  }
  return { passed, report: lines.join('\n') };
}
