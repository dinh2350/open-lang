# LiveKit facts for a Node.js Agent, self-hosted dev server, and React frontend

Checked 2026-11-14 against official LiveKit sources. Re-check versions before relying on them.

## Node agents framework

- `@livekit/agents` is at 1.10.0 (published 2026-11-13). The package has no `engines` field. https://www.npmjs.com/package/@livekit/agents
- The docs require Node.js >= 20 and pnpm >= 10.15.0. https://docs.livekit.io/agents/start/voice-ai
- `livekit-examples/agent-starter-node` uses pnpm, with engines `node >=24` and `pnpm >=10`, and `.nvmrc` set to 24. It runs `.ts` files directly (`node src/main.ts start`). Its dev script is `lk agent dev`. https://github.com/livekit-examples/agent-starter-node
- `WorkerOptions` is a deprecated alias of `ServerOptions`. `Worker` is a deprecated alias of `AgentServer`. https://github.com/livekit/agents-js/blob/main/agents/src/worker.ts

Current entrypoint shape, from the starter:

```ts
import { ServerOptions, cli, defineAgent, inference, voice } from '@livekit/agents';
import { fileURLToPath } from 'node:url';

export default defineAgent({
  entry: async (ctx) => {
    const session = new voice.AgentSession({
      stt: /* plugin or inference.STT */, llm: /* ... */, tts: /* ... */,
      turnHandling: { turnDetection: new inference.TurnDetector() },
    });
    await session.start({ agent: new voice.Agent({ instructions: '...' }), room: ctx.room });
    await ctx.connect();
    session.generateReply({ instructions: 'Greet the user.' });
  },
});

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url), agentName: 'my-agent' }));
```

## Node plugins

All are at 1.10.0. Source: https://github.com/livekit/agents-js/tree/main/plugins

- **STT:** openai, deepgram, assemblyai, cartesia, elevenlabs, google (beta), inworld, mistralai, baseten, azure, meta, nvidia, sarvam, soniox, xai
- **LLM:** openai, google, anthropic, cerebras, mistralai, baseten, perplexity. `mistral` is a deprecated alias.
- **TTS:** openai, deepgram, elevenlabs, cartesia, google (beta), assemblyai, fishaudio, hume, inworld, minimax, mistralai, neuphonic, resemble, rime, speechify, baseten, nvidia, sarvam, soniox, xai
- **Realtime models:** openai (Realtime and GPT-Live), google (Gemini Live), phonic, xai
- **VAD:** silero
- **Turn detection:** built into the core package as `inference.TurnDetector`. `agents-plugin-livekit` holds the deprecated text model.
- **Noise cancellation:** `agents-plugin-krisp`, `@livekit/plugins-ai-coustics`, `@livekit/noise-cancellation-node`

Azure support in Node:

- Azure OpenAI LLM: supported, via `openai.LLM.withAzure` (Chat Completions only).
- Azure OpenAI Realtime: supported, via `openai.realtime.RealtimeModel.withAzure({ azureDeployment, azureEndpoint, apiKey })`.
- Azure OpenAI STT and TTS: not supported. There is no `withAzure` for them in the Node source, and the docs list Node as unavailable. https://docs.livekit.io/agents/integrations/azure
- Azure Speech: `@livekit/agents-plugin-azure` exists, but it is STT only (`AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`). It has no TTS.

## Google (Gemini) and OpenAI plugins in Node

Read from the 1.10.0 npm source of `@livekit/agents-plugin-google` (same layout as `agents-js/plugins/google/src`) and its CHANGELOG.

- The Node Google plugin has **no** Google Cloud Speech-to-Text or Text-to-Speech classes. LiveKit docs mark Cloud `google.STT` and `google.TTS` as Python only. Its STT and TTS are Gemini models.
- **Realtime:** `google.realtime.RealtimeModel` (`src/realtime/index.ts`). Not beta since 1.4.5. `google.beta.realtime` is a deprecated re-export, but the docs page still shows that path: https://docs.livekit.io/agents/models/realtime/plugins/gemini/
  - Default model is `gemini-2.5-flash-native-audio-preview-12-2025` on the Gemini API and `gemini-live-2.5-flash-native-audio` on Vertex (`realtime_api.ts:451-455`). Default voice is `Puck`.
  - Google lists that Gemini API default as Preview, "limited to existing users", earliest shutdown 2027-03-31, replaced by `gemini-3.8-live`. https://aistudio.google.com/docs/models
  - Realtime video input does nothing in Node: `pushVideo` is a TODO (`realtime_api.ts:981-982`).
- **LLM:** `google.LLM` (`src/llm.ts`). `model` is required in Node. Without arguments it falls back to `gemini-2.0-flash-001`, which Google lists as deprecated with shutdown 2026-06-01. `google.AIPlatformLLM` exists for Vertex Model Garden endpoints.
- **STT:** `google.beta.GeminiSTT`, default `gemini-3.5-transcribe-live`, streaming only, added in 1.7.1. Its `prompt` and `temperature` options exist only in Python. The docs page still says Python only: https://docs.livekit.io/agents/models/stt/plugins/gemini/
- **TTS:** `google.beta.TTS`, default `gemini-3.1-flash-tts-preview`, voice `Kore`, no streaming. Google lists that model as Preview with shutdown **2026-12-18**, replaced by `gemini-3.8-flash-tts`.
- **Credentials:** all four work with either a Gemini API key or Vertex AI.
  - Gemini API: `GOOGLE_API_KEY` (STT also accepts `GEMINI_API_KEY` through `@google/genai`).
  - Vertex: `GOOGLE_GENAI_USE_VERTEXAI`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, plus Google's default credential lookup (`GOOGLE_APPLICATION_CREDENTIALS`).
  - The TTS class accepts `GOOGLE_GENAI_USE_VERTEXAI` only as `'true'`; the others also accept `1`.
  - Vertex location defaults to `us-central1`, but `global` for STT.
  - Realtime does not throw when the key is missing. LLM throws.
  - The README mentions `GOOGLE_GENAI_API_KEY`, but no plugin source reads it.
- **OpenAI** (realtime code lives in `@livekit/agents` `src/llm/openai_realtime/`):
  - Realtime: `openai.realtime.RealtimeModel`, default `gpt-realtime`, voice `marin`. `openai.realtime.GPTLiveModel` defaults to `gpt-live-1`.
  - LLM: `openai.LLM`, default `gpt-4.1`. `openai.responses.LLM` has the same default.
  - STT: `openai.STT`, default `gpt-realtime-whisper` (streaming), or `whisper-1` with `useRealtime: false`.
  - TTS: `openai.TTS`, default `tts-1`, voice `alloy`.
  - Env: `OPENAI_API_KEY`. Realtime also reads `OPENAI_BASE_URL`. Azure mode reads `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, and `OPENAI_API_VERSION`.

Takeaway: several plugin default models are deprecated or in Preview, and one shuts down in December 2026. Pin model names in config instead of relying on plugin defaults.

## Agent dispatch

Source: https://docs.livekit.io/agents/server/agent-dispatch

- Give the worker a name with `new ServerOptions({ agentName })`.
- To dispatch through the token, set `at.roomConfig = new RoomConfiguration({ agents: [new RoomAgentDispatch({ agentName, metadata })] })`. `livekit-server-sdk` exports both classes. This only takes effect when the room is first created. If the room already exists, it is ignored.
- To dispatch through the API, call `new AgentDispatchClient(host, key, secret).createDispatch(room, agentName, { metadata })`. This creates the room if it doesn't exist.
- A worker with `agentName` set only joins rooms it is explicitly dispatched to.
- A worker without `agentName` is dispatched to every new room automatically. The docs advise against this.

## Self-hosted dev server

- The Docker image is `livekit/livekit-server`. The latest version is v1.13.11 (2026-10-25).
- `--dev` does the following (https://github.com/livekit/livekit/blob/master/cmd/server/main.go):
  - Sets the log level to debug.
  - Uses API key `devkey` and secret `secret` when no keys are given.
  - Binds to 127.0.0.1 and ::1 unless you pass `--bind`.
  - Uses a single WebRTC UDP port, 7882.
  - Uses ports 30000-30002 for TURN relay.
- Ports (https://docs.livekit.io/transport/self-hosting/ports-firewall):
  - 7880: API and WebSocket signaling
  - 7881/tcp: ICE over TCP
  - 7882/udp in dev mode, or 50000-60000/udp otherwise
- Useful flags: `--node-ip` (env `NODE_IP`), `--udp-port`, `--keys`, `--config-body`.
- Docker on macOS:
  - The docs say Docker deployments should use host networking. https://docs.livekit.io/transport/self-hosting/deployment
  - On macOS, the docs recommend `brew install livekit` instead.
  - A LiveKit maintainer said WebRTC across the Docker layer on a Mac is "not something we can officially support". https://github.com/livekit/agents/issues/3335
- Not found: official guidance for using `--node-ip` with Docker Desktop.

## Features that need LiveKit Cloud

- **LiveKit Inference:** needs Cloud credentials. When self-hosting, use model plugins instead.
- **Enhanced noise cancellation:** ai-coustics and Krisp need Cloud transport. ai-coustics also accepts its own API key on a self-hosted server. https://docs.livekit.io/transport/media/noise-cancellation
- **Turn detector:**
  - `v1` runs on LiveKit Inference.
  - `v1-mini` runs locally on CPU and works anywhere.
  - In dev mode the default is `v1`, falling back to `v1-mini`.
  - https://docs.livekit.io/agents/logic/turns/turn-detector
- **Adaptive interruption handling:** runs on Inference and falls back to VAD.
- **Agent Observability:** Cloud projects only. OpenTelemetry trace export works anywhere. https://docs.livekit.io/testing/observability
- **Simulations:** run on LiveKit Cloud.

## Frontend

- `livekit-examples/agent-starter-react` uses Next.js 15.5, React 19, and Agents UI (shadcn components such as `AgentSessionProvider` and `AgentAudioVisualizerBar`). https://github.com/livekit-examples/agent-starter-react
- The official React quickstart uses Vite, with `BarVisualizer`, `ControlBar`, `RoomAudioRenderer`, and `TokenSource`. https://docs.livekit.io/frontends/start/react-quickstart
- Current hooks:
  - `useSession(tokenSource, { agentName })`
  - `SessionProvider` and `useSessionContext`
  - `useAgent()`, which returns `state` and `microphoneTrack`
  - `useSessionMessages`
- `useVoiceAssistant` still exists and is not deprecated.

Token endpoint shape expected by `TokenSource.endpoint` (https://docs.livekit.io/frontends/build/authentication/endpoint):

- Request: `POST` with these optional fields:
  - `room_name`
  - `participant_identity`
  - `participant_name`
  - `participant_metadata`
  - `participant_attributes`
  - `room_config`
- Response: `201` with `{ server_url, participant_token }`. The client accepts any 2xx response.
- The Next.js starter's own token route doesn't follow this shape exactly. It returns 200 with camelCase fields.
