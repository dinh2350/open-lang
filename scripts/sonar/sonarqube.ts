// A small client for the SonarQube Web API endpoints the scripts use.
// Responses are validated with zod, since they cross a process boundary.
import { z } from 'zod';

export type SonarQubeCredentials =
  | { readonly token: string }
  | { readonly login: string; readonly password: string };

type Params = Readonly<Record<string, string | number | undefined>>;

const errorBodySchema = z.object({
  errors: z.array(z.object({ msg: z.string() })),
});

function authorizationHeader(credentials: SonarQubeCredentials): string {
  if ('token' in credentials) {
    return `Bearer ${credentials.token}`;
  }
  const basic = Buffer.from(
    `${credentials.login}:${credentials.password}`,
  ).toString('base64');
  return `Basic ${basic}`;
}

function searchParams(params: Params): URLSearchParams {
  const result = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined) {
      result.set(name, String(value));
    }
  }
  return result;
}

async function errorMessage(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const body = errorBodySchema.safeParse(JSON.parse(text));
    if (body.success) {
      return body.data.errors.map((error) => error.msg).join('; ');
    }
  } catch {
    // Not JSON: fall through to the raw text.
  }
  return text || response.statusText;
}

/** A SonarQube Web API client for one server and one set of credentials. */
export class SonarQube {
  readonly hostUrl: string;
  readonly #credentials: SonarQubeCredentials | undefined;

  constructor(hostUrl: string, credentials?: SonarQubeCredentials) {
    this.hostUrl = hostUrl;
    this.#credentials = credentials;
  }

  /** Calls `GET /api/<path>` and parses the JSON response. */
  get<T>(path: string, params: Params, schema: z.ZodType<T>): Promise<T> {
    return this.call('GET', path, params, schema);
  }

  /** Calls `POST /api/<path>` and parses the JSON response, if any. */
  post<T>(path: string, params: Params, schema: z.ZodType<T>): Promise<T> {
    return this.call('POST', path, params, schema);
  }

  private async call<T>(
    method: 'GET' | 'POST',
    path: string,
    params: Params,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const url = new URL(`api/${path}`, `${this.hostUrl.replace(/\/$/, '')}/`);
    const headers: Record<string, string> = {};
    if (this.#credentials) {
      headers.Authorization = authorizationHeader(this.#credentials);
    }
    let body: URLSearchParams | undefined;
    if (method === 'GET') {
      url.search = searchParams(params).toString();
    } else {
      body = searchParams(params);
    }

    let response: Response;
    try {
      response = await fetch(url, { method, headers, body });
    } catch (error) {
      throw new Error(
        `SonarQube isn't reachable at ${this.hostUrl}. Start it with \`pnpm sonar:up\`.`,
        { cause: error },
      );
    }
    if (!response.ok) {
      throw new Error(
        `SonarQube ${method} /api/${path} failed with ${String(response.status)}: ${await errorMessage(response)}`,
      );
    }
    const text = await response.text();
    return schema.parse(text === '' ? undefined : JSON.parse(text));
  }
}
