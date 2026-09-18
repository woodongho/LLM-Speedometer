import type { TokenEvent } from './types';
import { consumeLines, type StreamEvent } from './sse';

export interface Message {
  role: string;
  content: string;
}

export interface RunConfig {
  /** Full endpoint URL, e.g. https://localhost:11434/v1/chat/completions */
  endpoint: string;
  apiKey?: string;
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  /** Override the stream flag (defaults to true). */
  stream?: boolean;
  systemPrompt?: string;
  onToken?: (token: string, index: number) => void;
  onEvent?: (event: StreamEvent) => void;
  onFinish?: (event: StreamEvent) => void;
}

export interface StreamHandle {
  events: StreamEvent[];
  tokens: TokenEvent[];
  text: string;
}

function buildPayload(config: RunConfig): Record<string, unknown> {
  const messages: Message[] = [];
  if (config.systemPrompt && config.systemPrompt.trim()) {
    messages.push({ role: 'system', content: config.systemPrompt.trim() });
  }
  messages.push(...config.messages);

  const payload: Record<string, unknown> = {
    model: config.model,
    messages,
    stream: config.stream ?? true,
  };
  if (typeof config.temperature === 'number') payload.temperature = config.temperature;
  if (typeof config.maxTokens === 'number') payload.max_tokens = config.maxTokens;
  return payload;
}

function authHeaders(config: RunConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey && config.apiKey.trim()) {
    headers.Authorization = `Bearer ${config.apiKey.trim()}`;
  }
  return headers;
}

/**
 * Open a streaming request to an OpenAI-compatible endpoint and yield decoded
 * stream events with timestamps measured from the moment the request is sent.
 *
 * Throws on non-OK HTTP responses or when the body is missing.
 */
export async function streamEvents(
  config: RunConfig,
  options: { signal?: AbortSignal; now?: () => number } = {},
): Promise<StreamHandle> {
  const now = options.now ?? (() => performance.now());
  const start = now();
  const signal = options.signal;

  const resp = await fetch(config.endpoint, {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify(buildPayload(config)),
    signal,
  });

  if (!resp.ok) {
    const bodyText = await safeText(resp);
    throw new HttpError(resp.status, resp.statusText, bodyText);
  }
  if (!resp.body) {
    throw new Error('Response body is empty; the server did not stream.');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let tokenIndex = 0;
  const events: StreamEvent[] = [];
  const tokens: TokenEvent[] = [];
  let text = '';
  let closed = false;

  const reader = resp.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) buffer += decoder.decode(value, { stream: true });

      const { events: batch, remainder } = consumeLines(buffer);
      buffer = remainder;

      for (const event of batch) {
        const ts = now() - start;
        events.push(event);
        config.onEvent?.(event);
        if (event.kind === 'token' && event.content) {
          for (const chunk of splitContent(event.content)) {
            tokens.push({ index: tokenIndex, content: chunk, ts });
            text += chunk;
            config.onToken?.(chunk, tokenIndex);
            tokenIndex++;
          }
        }
        if (event.kind === 'finish') {
          closed = true;
          config.onFinish?.(event);
        }
      }
    }
  } finally {
    reader.releaseLock?.();
  }

  // Flush any trailing line without a terminating newline.
  const finalEvents = consumeLines(buffer).events;
  for (const event of finalEvents) {
    const ts = now() - start;
    events.push(event);
    config.onEvent?.(event);
    if (event.kind === 'token' && event.content) {
      for (const chunk of splitContent(event.content)) {
        tokens.push({ index: tokenIndex, content: chunk, ts });
        text += chunk;
        config.onToken?.(chunk, tokenIndex);
        tokenIndex++;
      }
    }
    if (event.kind === 'finish') {
      closed = true;
      config.onFinish?.(event);
    }
  }

  return { events, tokens, text };
}

function splitContent(content: string): string[] {
  // Tokenizers split on grapheme boundaries; splitting on code points is a
  // reasonable, deterministic approximation for benchmarking purposes.
  return Array.from(content);
}

async function safeText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return '';
  }
}

export class HttpError extends Error {
  status: number;
  statusText: string;
  body: string;
  constructor(status: number, statusText: string, body: string) {
    super(`Request failed with HTTP ${status} ${statusText}`);
    this.name = 'HttpError';
    this.status = status;
    this.statusText = statusText;
    this.body = body.slice(0, 500);
  }
}

export class NetworkError extends Error {
  constructor(message = 'Network request failed (check the endpoint URL and connectivity).') {
    super(message);
    this.name = 'NetworkError';
  }
}
