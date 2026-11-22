import { applyDecorators, UseGuards } from '@nestjs/common';
import { AgentKeyGuard } from '../guards/agent-key.guard.js';
import { Public } from './public.decorator.js';

/**
 * Restricts a controller or route to the Agent, which authenticates with the
 * shared `AGENT_API_KEY`. The route is `@Public()` for the Auth Token guard,
 * so no User, whatever their Role, can call it.
 */
export const AgentOnly = () =>
  applyDecorators(Public(), UseGuards(AgentKeyGuard));
