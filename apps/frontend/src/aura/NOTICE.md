# Notice

Some files in this folder are derived from LiveKit's `components-js`, which is
licensed under the Apache License, Version 2.0. The licence text is in
[`LICENSE-LiveKit-Apache-2.0.txt`](./LICENSE-LiveKit-Apache-2.0.txt), copied
from <https://github.com/livekit/components-js/blob/main/LICENSE>.

## Derived files

| File             | Source                                                                                                                                                                                                           | Modified |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `aura-shader.ts` | `shaderSource` in `packages/shadcn/components/agents-ui/agent-audio-visualizer-aura.tsx` of [livekit/components-js](https://github.com/livekit/components-js), commit `370cbca23dab6ea5e65c474e4060e4895f435f33` | Yes      |

What was modified in `aura-shader.ts`: the GLSL was moved into a TypeScript
string. Nothing else was changed. The file says so in its header comment.

`webgl-program.ts` is not derived from LiveKit's code; it is written for this
project.
