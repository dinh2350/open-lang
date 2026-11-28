import { voice } from '@livekit/agents';
import type { LearnerBrief } from '@open-lang/shared';
import { describe, expect, it } from 'vitest';
import { TutorAgent } from '../src/agent.ts';
import { createBackendClient } from '../src/backend-client.ts';
import { createSaveNoteTool } from '../src/note-tool.ts';
import {
  TUTOR_INSTRUCTIONS,
  tutorInstructions,
} from '../src/tutor-instructions.ts';

describe('TutorAgent', () => {
  it('is a voice.Agent', () => {
    expect(new TutorAgent()).toBeInstanceOf(voice.Agent);
  });

  it('follows the tutor instructions', () => {
    expect(new TutorAgent().instructions).toBe(TUTOR_INSTRUCTIONS);
  });

  it('follows the instructions of the note order it is given', () => {
    expect(new TutorAgent([], 'before-speaking').instructions).toBe(
      tutorInstructions('before-speaking'),
    );
  });

  it('a TutorAgent with a brief follows the instructions that include it', () => {
    const brief: LearnerBrief = {
      version: 1,
      items: [{ english: 'deadline', meaning: 'hạn chót', status: 'learning' }],
    };
    const { instructions } = new TutorAgent([], 'before-speaking', brief);

    expect(instructions).toBe(tutorInstructions('before-speaking', brief));
    expect(instructions).toContain('- [learning] deadline = hạn chót');
  });

  it('follows the tutor instructions when the brief is null', () => {
    expect(new TutorAgent([], 'after-speaking', null).instructions).toBe(
      TUTOR_INSTRUCTIONS,
    );
  });

  it('has the tools it is given, and only those', () => {
    const backend = createBackendClient({
      backendUrl: 'http://127.0.0.1:1',
      agentApiKey: 'unused',
    });
    const { functionTools, providerTools, toolsets } = new TutorAgent([
      createSaveNoteTool({ backend, roomName: 'conversation-123' }),
    ]).toolCtx;

    expect(Object.keys(functionTools)).toEqual(['saveNote']);
    expect(providerTools).toEqual([]);
    expect(toolsets).toEqual([]);
  });

  it('has no tools when given none', () => {
    expect(Object.keys(new TutorAgent().toolCtx.functionTools)).toEqual([]);
  });
});
