import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { onTestFinished } from 'vitest';

export const FAKE_SONARQUBE_URL = 'http://sonarqube.test';
const DEFAULT_ADMIN_PASSWORD = 'admin';
const BUILT_IN_GATE = 'Sonar way';

type Params = Record<string, string | undefined>;

export interface GateCondition {
  readonly metric: string;
  readonly op: string;
  readonly error: string;
}

interface StoredCondition extends GateCondition {
  readonly id: string;
}

/** An open issue; `file` is the path from the repo root. */
export interface FakeIssue {
  readonly file: string;
  readonly line?: number;
  readonly rule: string;
  readonly message: string;
}

/** A Security Hotspot to review; `file` is the path from the repo root. */
export interface FakeHotspot {
  readonly file: string;
  readonly line?: number;
  readonly rule: string;
  readonly message: string;
}

/** A quality gate condition as `project_status` reports it. */
export interface FakeConditionStatus {
  readonly status: 'OK' | 'ERROR';
  readonly metricKey: string;
  readonly comparator: 'GT' | 'LT';
  readonly errorThreshold: string;
  readonly actualValue: string;
}

/** A file's measures, as `measures/component_tree` reports them. */
export interface FakeFileMeasures {
  readonly path: string;
  readonly measures: Readonly<Record<string, string>>;
}

export interface FakeAnalysis {
  /** The task statuses that successive `ce/task` polls return, ending with the last. */
  readonly taskStatuses?: readonly string[];
  readonly taskErrorMessage?: string;
  readonly gate?: 'OK' | 'ERROR';
  readonly conditions?: readonly FakeConditionStatus[];
  readonly issues?: readonly FakeIssue[];
  readonly hotspots?: readonly FakeHotspot[];
  readonly files?: readonly FakeFileMeasures[];
}

interface StoredAnalysis {
  readonly ceTaskId: string;
  readonly analysisId: string;
  readonly taskStatuses: string[];
  readonly taskErrorMessage?: string;
  readonly gate: 'OK' | 'ERROR';
  readonly conditions: readonly FakeConditionStatus[];
  readonly files: readonly FakeFileMeasures[];
}

const PROJECT_KEY = 'open-lang';

function page<T>(items: readonly T[], params: Params) {
  const pageSize = Number(params.ps ?? 100);
  const pageIndex = Number(params.p ?? 1);
  return {
    paging: { pageIndex, pageSize, total: items.length },
    items: items.slice((pageIndex - 1) * pageSize, pageIndex * pageSize),
  };
}

/** Query and form parameters, as SonarQube's Web API accepts both. */
async function paramsOf(request: Request): Promise<Params> {
  const params: Params = Object.fromEntries(new URL(request.url).searchParams);
  if (request.method === 'POST') {
    const body = new URLSearchParams(await request.text());
    Object.assign(params, Object.fromEntries(body));
  }
  return params;
}

function errorResponse(status: number, message: string) {
  return HttpResponse.json({ errors: [{ msg: message }] }, { status });
}

const noContent = () => new HttpResponse(null, { status: 204 });

function byMetric(conditions: readonly GateCondition[]): GateCondition[] {
  return conditions
    .map(({ metric, op, error }) => ({ metric, op, error }))
    .sort((a, b) => a.metric.localeCompare(b.metric));
}

/**
 * An in-memory SonarQube Web API, serving the endpoints the scripts call.
 * It starts like a fresh install: the `admin` user with its default
 * password, and the built-in "Sonar way" gate as the default. It stops at
 * the end of the test.
 */
export function startFakeSonarQube({
  adminPassword = DEFAULT_ADMIN_PASSWORD,
}: { adminPassword?: string } = {}) {
  const state = {
    adminPassword,
    projects: new Map<string, string>(),
    gates: new Map<string, StoredCondition[]>([[BUILT_IN_GATE, []]]),
    defaultGate: BUILT_IN_GATE,
    /** The admin user's tokens by name. */
    tokens: new Map<string, { value: string; type: string }>(),
    analyses: [] as StoredAnalysis[],
    /** Issues and hotspots belong to the project, from its latest analysis. */
    issues: [] as readonly FakeIssue[],
    hotspots: [] as readonly FakeHotspot[],
    nextId: 1,
  };
  const newId = () => `AZ-${String(state.nextId++)}`;

  function tokenOf(request: Request) {
    const authorization = request.headers.get('Authorization') ?? '';
    const value = /^Bearer (.+)$/.exec(authorization)?.[1];
    return [...state.tokens.values()].find((token) => token.value === value);
  }

  function isAdmin(request: Request): boolean {
    const expected = Buffer.from(`admin:${state.adminPassword}`).toString(
      'base64',
    );
    return request.headers.get('Authorization') === `Basic ${expected}`;
  }

  /** A Web API endpoint that only the admin user may call. */
  function adminEndpoint(
    method: 'get' | 'post',
    path: string,
    respond: (params: Params) => Response,
  ) {
    return http[method](
      `${FAKE_SONARQUBE_URL}/api/${path}`,
      async ({ request }) => {
        if (!isAdmin(request)) {
          return errorResponse(401, 'Unauthorized');
        }
        return respond(await paramsOf(request));
      },
    );
  }

  /** A Web API endpoint that a valid token, or the admin user, may call. */
  function tokenEndpoint(
    path: string,
    respond: (params: Params) => Response,
    { projectAnalysisTokens }: { projectAnalysisTokens: 'allowed' | 'denied' },
  ) {
    return http.get(
      `${FAKE_SONARQUBE_URL}/api/${path}`,
      async ({ request }) => {
        const token = tokenOf(request);
        if (!isAdmin(request) && !token) {
          return errorResponse(401, 'Unauthorized');
        }
        // As in SonarQube 26.11: a project analysis token may scan and read
        // the gate and issues, but not hotspots, analyses or measures.
        if (
          token?.type === 'PROJECT_ANALYSIS_TOKEN' &&
          projectAnalysisTokens === 'denied'
        ) {
          return errorResponse(403, 'Insufficient privileges');
        }
        return respond(await paramsOf(request));
      },
    );
  }

  const allowed = { projectAnalysisTokens: 'allowed' } as const;
  const denied = { projectAnalysisTokens: 'denied' } as const;

  const fileKey = (file: string) => `${PROJECT_KEY}:${file}`;
  const fileComponents = (files: readonly string[]) =>
    [...new Set(files)].map((file) => ({
      key: fileKey(file),
      path: file,
      qualifier: 'FIL',
    }));

  function findCondition(id = '') {
    for (const conditions of state.gates.values()) {
      const index = conditions.findIndex((condition) => condition.id === id);
      if (index >= 0) {
        return { conditions, index };
      }
    }
    return undefined;
  }

  const server = setupServer(
    http.get(`${FAKE_SONARQUBE_URL}/api/system/status`, () =>
      HttpResponse.json({ status: 'UP', version: '26.11' }),
    ),
    http.get(
      `${FAKE_SONARQUBE_URL}/api/authentication/validate`,
      ({ request }) =>
        HttpResponse.json({
          valid: isAdmin(request) || tokenOf(request) !== undefined,
        }),
    ),
    adminEndpoint('post', 'users/change_password', (params) => {
      if (params.previousPassword !== state.adminPassword) {
        return errorResponse(400, 'Incorrect old password');
      }
      state.adminPassword = params.password ?? '';
      return noContent();
    }),

    adminEndpoint('get', 'projects/search', (params) => {
      const keys = params.projects?.split(',') ?? [];
      const components = [...state.projects]
        .filter(([key]) => keys.length === 0 || keys.includes(key))
        .map(([key, name]) => ({ key, name, qualifier: 'TRK' }));
      return HttpResponse.json({
        paging: { pageIndex: 1, pageSize: 100, total: components.length },
        components,
      });
    }),
    adminEndpoint('post', 'projects/create', ({ project = '', name = '' }) => {
      if (state.projects.has(project)) {
        return errorResponse(
          400,
          `Could not create Project with key: "${project}". A similar key already exists: "${project}"`,
        );
      }
      state.projects.set(project, name);
      return HttpResponse.json({
        project: { key: project, name, qualifier: 'TRK' },
      });
    }),

    adminEndpoint('get', 'qualitygates/list', () =>
      HttpResponse.json({
        qualitygates: [...state.gates.keys()].map((name) => ({
          name,
          isDefault: name === state.defaultGate,
          isBuiltIn: name === BUILT_IN_GATE,
        })),
      }),
    ),
    adminEndpoint('get', 'qualitygates/show', ({ name = '' }) => {
      const conditions = state.gates.get(name);
      if (!conditions) {
        return errorResponse(
          404,
          `No quality gate has been found for name ${name}`,
        );
      }
      return HttpResponse.json({
        name,
        isBuiltIn: name === BUILT_IN_GATE,
        conditions,
      });
    }),
    adminEndpoint('post', 'qualitygates/create', ({ name = '' }) => {
      if (state.gates.has(name)) {
        return errorResponse(400, 'Name has already been taken');
      }
      // Like SonarQube 26.11, a new gate starts with the Clean as You Code
      // conditions on new code.
      state.gates.set(name, [
        { id: newId(), metric: 'new_violations', op: 'GT', error: '0' },
        { id: newId(), metric: 'new_coverage', op: 'LT', error: '80' },
        {
          id: newId(),
          metric: 'new_duplicated_lines_density',
          op: 'GT',
          error: '3',
        },
        {
          id: newId(),
          metric: 'new_security_hotspots_reviewed',
          op: 'LT',
          error: '100',
        },
      ]);
      return HttpResponse.json({ name });
    }),
    adminEndpoint('post', 'qualitygates/create_condition', (params) => {
      const conditions = state.gates.get(params.gateName ?? '');
      if (!conditions) {
        return errorResponse(404, 'No quality gate has been found');
      }
      const condition: StoredCondition = {
        id: newId(),
        metric: params.metric ?? '',
        op: params.op ?? '',
        error: params.error ?? '',
      };
      conditions.push(condition);
      return HttpResponse.json(condition);
    }),
    adminEndpoint('post', 'qualitygates/update_condition', (params) => {
      const found = findCondition(params.id);
      if (!found) {
        return errorResponse(404, 'No quality gate condition with id');
      }
      found.conditions[found.index] = {
        id: params.id ?? '',
        metric: params.metric ?? '',
        op: params.op ?? '',
        error: params.error ?? '',
      };
      return noContent();
    }),
    adminEndpoint('post', 'qualitygates/delete_condition', (params) => {
      const found = findCondition(params.id);
      if (!found) {
        return errorResponse(404, 'No quality gate condition with id');
      }
      found.conditions.splice(found.index, 1);
      return noContent();
    }),
    adminEndpoint('post', 'qualitygates/set_as_default', ({ name = '' }) => {
      if (!state.gates.has(name)) {
        return errorResponse(404, 'No quality gate has been found');
      }
      state.defaultGate = name;
      return noContent();
    }),

    adminEndpoint('get', 'user_tokens/search', () =>
      HttpResponse.json({
        login: 'admin',
        userTokens: [...state.tokens].map(([name, { type }]) => ({
          name,
          type,
          createdAt: '2026-11-14T12:00:00+0000',
        })),
      }),
    ),
    adminEndpoint('post', 'user_tokens/generate', (params) => {
      const name = params.name ?? '';
      if (state.tokens.has(name)) {
        return errorResponse(
          400,
          `A user token for login 'admin' and name '${name}' already exists`,
        );
      }
      const token = {
        value: `squ_${newId()}`,
        type: params.type ?? 'USER_TOKEN',
      };
      state.tokens.set(name, token);
      return HttpResponse.json({
        login: 'admin',
        name,
        token: token.value,
        type: token.type,
        projectKey: params.projectKey,
        createdAt: '2026-11-14T12:00:00+0000',
      });
    }),
    adminEndpoint('post', 'user_tokens/revoke', ({ name = '' }) => {
      if (!state.tokens.delete(name)) {
        return errorResponse(404, `User token with name '${name}' not found`);
      }
      return noContent();
    }),

    tokenEndpoint(
      'ce/task',
      ({ id }) => {
        const analysis = state.analyses.find((a) => a.ceTaskId === id);
        if (!analysis) {
          return errorResponse(404, `No activity found for task '${id ?? ''}'`);
        }
        const status =
          analysis.taskStatuses.length > 1
            ? analysis.taskStatuses.shift()
            : analysis.taskStatuses[0];
        return HttpResponse.json({
          task: {
            id: analysis.ceTaskId,
            type: 'REPORT',
            componentKey: PROJECT_KEY,
            status,
            ...(status === 'SUCCESS' && { analysisId: analysis.analysisId }),
            ...(status === 'FAILED' && {
              errorMessage: analysis.taskErrorMessage,
            }),
          },
        });
      },
      allowed,
    ),
    tokenEndpoint(
      'qualitygates/project_status',
      ({ analysisId }) => {
        const analysis = state.analyses.find(
          (a) => a.analysisId === analysisId,
        );
        if (!analysis) {
          return errorResponse(404, `Analysis with id '${analysisId ?? ''}'`);
        }
        return HttpResponse.json({
          projectStatus: {
            status: analysis.gate,
            conditions: analysis.conditions,
          },
        });
      },
      allowed,
    ),
    tokenEndpoint(
      'project_analyses/search',
      (params) => {
        const { paging, items } = page([...state.analyses].reverse(), params);
        return HttpResponse.json({
          paging,
          analyses: items.map((analysis) => ({
            key: analysis.analysisId,
            date: '2026-11-14T12:00:00+0000',
          })),
        });
      },
      denied,
    ),
    tokenEndpoint(
      'issues/search',
      (params) => {
        const { paging, items } = page(state.issues, params);
        return HttpResponse.json({
          total: paging.total,
          p: paging.pageIndex,
          ps: paging.pageSize,
          paging,
          issues: items.map((issue, index) => ({
            key: `issue-${String(index)}`,
            rule: issue.rule,
            component: fileKey(issue.file),
            project: PROJECT_KEY,
            ...(issue.line !== undefined && { line: issue.line }),
            message: issue.message,
            status: 'OPEN',
          })),
          components: fileComponents(items.map((issue) => issue.file)),
        });
      },
      allowed,
    ),
    tokenEndpoint(
      'hotspots/search',
      (params) => {
        const { paging, items } = page(state.hotspots, params);
        return HttpResponse.json({
          paging,
          hotspots: items.map((hotspot, index) => ({
            key: `hotspot-${String(index)}`,
            component: fileKey(hotspot.file),
            project: PROJECT_KEY,
            securityCategory: 'insecure-conf',
            vulnerabilityProbability: 'LOW',
            status: 'TO_REVIEW',
            ...(hotspot.line !== undefined && { line: hotspot.line }),
            message: hotspot.message,
            ruleKey: hotspot.rule,
          })),
          components: fileComponents(items.map((hotspot) => hotspot.file)),
        });
      },
      denied,
    ),
    tokenEndpoint(
      'measures/component_tree',
      (params) => {
        const sortMetric = params.metricSort ?? '';
        const latest = state.analyses.at(-1);
        const files = [...(latest?.files ?? [])]
          .filter((file) => sortMetric in file.measures)
          .sort(
            (a, b) =>
              Number(b.measures[sortMetric]) - Number(a.measures[sortMetric]),
          );
        const { paging, items } = page(files, params);
        return HttpResponse.json({
          paging,
          baseComponent: { key: PROJECT_KEY, qualifier: 'TRK' },
          components: items.map((file) => ({
            key: fileKey(file.path),
            path: file.path,
            qualifier: 'FIL',
            measures: Object.entries(file.measures).map(([metric, value]) => ({
              metric,
              value,
            })),
          })),
        });
      },
      denied,
    ),
  );
  server.listen({ onUnhandledFrame: 'error' });
  onTestFinished(() => {
    server.close();
  });

  return {
    /** Whether `password` is the admin user's password now. */
    acceptsAdminPassword: (password: string) =>
      state.adminPassword === password,
    projects: () => [...state.projects].map(([key, name]) => ({ key, name })),
    /** The default quality gate, with its conditions sorted by metric. */
    defaultQualityGate: () => ({
      name: state.defaultGate,
      conditions: byMetric(state.gates.get(state.defaultGate) ?? []),
    }),
    /** Someone edits a gate's conditions in the UI. */
    changeQualityGate(
      name: string,
      change: (conditions: GateCondition[]) => GateCondition[],
    ): void {
      const changed = change(byMetric(state.gates.get(name) ?? []));
      state.gates.set(
        name,
        changed.map((condition) => ({ ...condition, id: newId() })),
      );
    },
    setDefaultQualityGate(name: string): void {
      state.defaultGate = name;
    },
    /** The name of the valid token with this value, if there is one. */
    analysisTokenNamed: (value: string) =>
      [...state.tokens].find(([, token]) => token.value === value)?.[0],
    /** A valid analysis token, as `pnpm sonar:setup` writes it. */
    analysisToken(): string {
      const value = `squ_${newId()}`;
      state.tokens.set(`token ${value}`, { value, type: 'USER_TOKEN' });
      return value;
    },
    /**
     * The scanner submits an analysis report. SonarQube processes it into an
     * analysis whose issues and hotspots replace the project's current ones.
     */
    analyze(analysis: FakeAnalysis = {}) {
      const stored: StoredAnalysis = {
        ceTaskId: newId(),
        analysisId: newId(),
        taskStatuses: [...(analysis.taskStatuses ?? ['SUCCESS'])],
        ...(analysis.taskErrorMessage !== undefined && {
          taskErrorMessage: analysis.taskErrorMessage,
        }),
        gate: analysis.gate ?? 'OK',
        conditions: analysis.conditions ?? [],
        files: analysis.files ?? [],
      };
      state.analyses.push(stored);
      state.issues = analysis.issues ?? [];
      state.hotspots = analysis.hotspots ?? [];
      return { ceTaskId: stored.ceTaskId, analysisId: stored.analysisId };
    },
  };
}
