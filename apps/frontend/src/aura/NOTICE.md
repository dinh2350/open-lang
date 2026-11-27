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

## Attribution from the upstream NOTICE file

The `NOTICE` file at the root of livekit/components-js, at commit
`370cbca23dab6ea5e65c474e4060e4895f435f33`, begins with this notice, which
applies to `aura-shader.ts` (Apache License 2.0, section 4(d)):

> Copyright 2023 LiveKit, Inc.

The same upstream `NOTICE` also says that LiveKit's product includes code from
[react-shaders](https://github.com/rysana-ai/react-shaders) (MIT License,
copyright Morgan Villedieu and Rysana, Inc.). In that repository this goes
with `react-shader-toy.tsx`, the React renderer, which carries the MIT licence
in its header. `agent-audio-visualizer-aura.tsx` has no such notice, the Aura
GLSL is not from react-shaders, and `react-shader-toy.tsx` was not copied, so
that notice is not reproduced.
