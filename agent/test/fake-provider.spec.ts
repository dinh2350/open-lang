import { voice } from '@livekit/agents';
import { describe, expect, it } from 'vitest';
import { fakeProviderSessionOptions } from '../src/fake-provider.ts';

describe('fake Provider', () => {
  it("uses the framework's FakeLLM, so the Agent makes no AI calls and needs no API key", () => {
    expect(fakeProviderSessionOptions().llm).toBeInstanceOf(
      voice.testing.FakeLLM,
    );
  });

  it('turns off the VAD and the turn detector, which would load local models or call LiveKit Inference', () => {
    const options = fakeProviderSessionOptions();

    expect(options.vad).toBeNull();
    expect(options.turnHandling?.turnDetection).toBeNull();
  });
});
