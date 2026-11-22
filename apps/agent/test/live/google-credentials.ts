/**
 * Whether the environment has Google credentials of either kind: a Gemini
 * API key, or Vertex AI. The Agent's configuration names anything missing.
 */
export function hasGoogleCredentials(env: NodeJS.ProcessEnv): boolean {
  return (
    Boolean(env.GOOGLE_API_KEY) || env.GOOGLE_GENAI_USE_VERTEXAI === 'true'
  );
}
