// The Agent's config module: environment in, validated configuration out,
// and the session options (models, VAD, turn detection) built from it.
export { type AgentConfig, loadAgentConfig } from './agent-config.ts';
export { createSessionOptions } from './session-options.ts';
