/**
 * Normalize a user-provided OpenAI-compatible base endpoint into a full
 * chat-completions URL.
 *
 * Rules:
 *   - Already ends in /chat/completions  -> returned unchanged
 *   - Ends in /v1                        -> /v1/chat/completions
 *   - Plain base (e.g. http://host:port) -> /v1/chat/completions
 */
export function normalizeEndpoint(endpoint: string): string {
  let e = endpoint.trim().replace(/\/+$/, '')
  if (!e) return e
  if (/\/chat\/completions$/.test(e)) return e
  if (/\/v1$/.test(e)) return `${e}/chat/completions`
  return `${e}/v1/chat/completions`
}
