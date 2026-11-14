// `pnpm sonar:setup`: configures the local SonarQube through its Web API.
// Every step checks the current state first, so it is safe to rerun from
// any checkout.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { QUALITY_GATE, SONAR_PROJECT } from './project.ts';
import { SonarQube } from './sonarqube.ts';

const DEFAULT_ADMIN_PASSWORD = 'admin';
// A project analysis token may scan, but can't read the hotspots, analyses
// and measures that `pnpm sonar` reports. A user token of the admin adds no
// exposure: the same .env holds the admin password.
const ANALYSIS_TOKEN_TYPE = 'USER_TOKEN';

export interface SonarQubeSetup {
  readonly hostUrl: string;
  /** The admin password to set, from `SONAR_ADMIN_PASSWORD`. */
  readonly adminPassword: string;
  /** The checkout's git-ignored env file, which receives `SONAR_TOKEN`. */
  readonly envFile: string;
  /** Unique per checkout, so each checkout regenerates only its own token. */
  readonly tokenName: string;
  readonly log: (message: string) => void;
}

const validationSchema = z.object({ valid: z.boolean() });
const noContentSchema = z.undefined();

async function acceptsAdminPassword(
  hostUrl: string,
  password: string,
): Promise<boolean> {
  const sonarQube = new SonarQube(hostUrl, { login: 'admin', password });
  const { valid } = await sonarQube.get(
    'authentication/validate',
    {},
    validationSchema,
  );
  return valid;
}

/** Makes sure the admin user's password is `adminPassword`. */
async function setAdminPassword(setup: SonarQubeSetup): Promise<SonarQube> {
  const admin = new SonarQube(setup.hostUrl, {
    login: 'admin',
    password: setup.adminPassword,
  });
  if (await acceptsAdminPassword(setup.hostUrl, setup.adminPassword)) {
    setup.log('Admin password: already set.');
    return admin;
  }
  if (!(await acceptsAdminPassword(setup.hostUrl, DEFAULT_ADMIN_PASSWORD))) {
    throw new Error(
      'SonarQube rejects SONAR_ADMIN_PASSWORD, and the default admin password no longer works. ' +
        'Set SONAR_ADMIN_PASSWORD in .env to the password an earlier `pnpm sonar:setup` set.',
    );
  }
  await new SonarQube(setup.hostUrl, {
    login: 'admin',
    password: DEFAULT_ADMIN_PASSWORD,
  }).post(
    'users/change_password',
    {
      login: 'admin',
      previousPassword: DEFAULT_ADMIN_PASSWORD,
      password: setup.adminPassword,
    },
    noContentSchema,
  );
  setup.log(
    'Admin password: changed from the default to SONAR_ADMIN_PASSWORD.',
  );
  return admin;
}

const projectSearchSchema = z.object({
  components: z.array(z.object({ key: z.string() })),
});
const projectCreationSchema = z.object({
  project: z.object({ key: z.string() }),
});

async function createProject(
  admin: SonarQube,
  log: SonarQubeSetup['log'],
): Promise<void> {
  const { components } = await admin.get(
    'projects/search',
    { projects: SONAR_PROJECT.key },
    projectSearchSchema,
  );
  if (components.some((project) => project.key === SONAR_PROJECT.key)) {
    log(`Project ${SONAR_PROJECT.key}: already exists.`);
    return;
  }
  await admin.post(
    'projects/create',
    { project: SONAR_PROJECT.key, name: SONAR_PROJECT.name },
    projectCreationSchema,
  );
  log(`Project ${SONAR_PROJECT.key}: created.`);
}

const gateListSchema = z.object({
  qualitygates: z.array(z.object({ name: z.string(), isDefault: z.boolean() })),
});
const gateSchema = z.object({
  conditions: z
    .array(
      z.object({
        id: z.union([z.string(), z.number()]).transform(String),
        metric: z.string(),
        op: z.string(),
        error: z.string(),
      }),
    )
    .default([]),
});
const gateCreationSchema = z.object({ name: z.string() });
const conditionCreationSchema = z.object({ metric: z.string() });

/** Creates the quality gate if needed, sets its conditions, and makes it the default. */
async function setQualityGate(
  admin: SonarQube,
  log: SonarQubeSetup['log'],
): Promise<void> {
  const gateName = QUALITY_GATE.name;
  const { qualitygates } = await admin.get(
    'qualitygates/list',
    {},
    gateListSchema,
  );
  const existingGate = qualitygates.find((gate) => gate.name === gateName);
  if (existingGate) {
    log(`Quality gate "${gateName}": already exists.`);
  } else {
    await admin.post(
      'qualitygates/create',
      { name: gateName },
      gateCreationSchema,
    );
    log(`Quality gate "${gateName}": created.`);
  }

  const { conditions } = await admin.get(
    'qualitygates/show',
    { name: gateName },
    gateSchema,
  );
  for (const condition of conditions) {
    if (!QUALITY_GATE.conditions.some((c) => c.metric === condition.metric)) {
      await admin.post(
        'qualitygates/delete_condition',
        { id: condition.id },
        noContentSchema,
      );
      log(`  removed the condition on ${condition.metric}`);
    }
  }
  for (const wanted of QUALITY_GATE.conditions) {
    const current = conditions.find((c) => c.metric === wanted.metric);
    if (!current) {
      await admin.post(
        'qualitygates/create_condition',
        { gateName, ...wanted },
        conditionCreationSchema,
      );
      log(`  added ${wanted.metric} ${wanted.op} ${wanted.error}`);
    } else if (current.op !== wanted.op || current.error !== wanted.error) {
      await admin.post(
        'qualitygates/update_condition',
        { id: current.id, ...wanted },
        noContentSchema,
      );
      log(`  restored ${wanted.metric} ${wanted.op} ${wanted.error}`);
    }
  }

  if (existingGate?.isDefault) {
    log(`Quality gate "${gateName}": already the default.`);
  } else {
    await admin.post(
      'qualitygates/set_as_default',
      { name: gateName },
      noContentSchema,
    );
    log(`Quality gate "${gateName}": now the default.`);
  }
}

const tokenSearchSchema = z.object({
  userTokens: z.array(z.object({ name: z.string() })),
});
const tokenGenerationSchema = z.object({ token: z.string().min(1) });

/**
 * Generates a new analysis token under the checkout's own name. A token left
 * by an earlier run is revoked first, so reruns never fail on a taken name,
 * and other checkouts' tokens stay valid.
 */
async function generateAnalysisToken(
  admin: SonarQube,
  setup: SonarQubeSetup,
): Promise<string> {
  const { userTokens } = await admin.get(
    'user_tokens/search',
    {},
    tokenSearchSchema,
  );
  if (userTokens.some((token) => token.name === setup.tokenName)) {
    await admin.post(
      'user_tokens/revoke',
      { name: setup.tokenName },
      noContentSchema,
    );
    setup.log(`Analysis token "${setup.tokenName}": revoked the old one.`);
  }
  const { token } = await admin.post(
    'user_tokens/generate',
    { name: setup.tokenName, type: ANALYSIS_TOKEN_TYPE },
    tokenGenerationSchema,
  );
  setup.log(`Analysis token "${setup.tokenName}": generated.`);
  return token;
}

/** Sets `name=value` in env file content, replacing an earlier value. */
function withEnvVariable(content: string, name: string, value: string): string {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }
  const separator = content === '' || content.endsWith('\n') ? '' : '\n';
  return `${content}${separator}${line}\n`;
}

function writeEnvVariable(envFile: string, name: string, value: string): void {
  const content = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
  writeFileSync(envFile, withEnvVariable(content, name, value));
}

export async function setUpSonarQube(setup: SonarQubeSetup): Promise<void> {
  const admin = await setAdminPassword(setup);
  await createProject(admin, setup.log);
  await setQualityGate(admin, setup.log);
  const token = await generateAnalysisToken(admin, setup);
  writeEnvVariable(setup.envFile, 'SONAR_TOKEN', token);
  setup.log(`Wrote SONAR_TOKEN to ${setup.envFile}.`);
}
