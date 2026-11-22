// Process entrypoint of the agent server. It only reads the environment and
// hands over to the @livekit/agents CLI; the Agent's behavior lives in
// conversation-agent.ts, which the CLI loads in its job processes.
import { fileURLToPath } from 'node:url';
import { cli, ServerOptions } from '@livekit/agents';
import { loadAgentEnvironment } from './agent-environment.ts';
import { loadAgentConfig } from './config/index.ts';

// Node's watch mode (the `dev` script) sets this variable. The Agent's job and
// inference processes would inherit it and send Node's dependency reports over
// the framework's IPC channel, which makes the agent server fail at startup.
delete process.env.WATCH_REPORT_DEPENDENCIES;

// Refuses to start, naming the variable, without the LiveKit settings, the
// BACKEND_URL or a valid AGENT_API_KEY.
const { AGENT_NAME } = loadAgentEnvironment(process.env);
// Refuses to start on a bad Agent Mode, Provider, API key or model, before
// the agent server registers with LiveKit. Each job reads it again.
loadAgentConfig(process.env);
cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(new URL('conversation-agent.ts', import.meta.url)),
    agentName: AGENT_NAME,
  }),
);
