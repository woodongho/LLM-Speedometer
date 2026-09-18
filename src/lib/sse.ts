import type { OllamaMeta, UsageInfo } from './types';

export type StreamEventKind = 'token' | 'usage' | 'finish';

export interface StreamEvent {
  kind: StreamEventKind;
  /** Delta text (empty string for non-content deltas). */
  content?: string;
  usage?: UsageInfo;
  ollama?: OllamaMeta;
  finishReason?: string | null;
}

function toNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function extractUsage(u: any): UsageInfo | undefined {
  const prompt_tokens = toNumber(u?.prompt_tokens);
  const completion_tokens = toNumber(u?.completion_tokens);
  const total_tokens = toNumber(u?.total_tokens);
  if (prompt_tokens === undefined && completion_tokens === undefined && total_tokens === undefined) {
    return undefined;
  }
  return { prompt_tokens, completion_tokens, total_tokens };
}

export function extractOllama(obj: any): OllamaMeta | undefined {
  const keys = [
    'prompt_eval_count',
    'eval_count',
    'eval_duration',
    'prompt_eval_duration',
  ];
  const present = keys.some((k) => k in obj && obj[k] !== undefined);
  if (!present) return undefined;
  return {
    prompt_eval_count: toNumber(obj.prompt_eval_count),
    eval_count: toNumber(obj.eval_count),
    eval_duration: toNumber(obj.eval_duration),
    prompt_eval_duration: toNumber(obj.prompt_eval_duration),
  };
}

/**
 * Normalize a single parsed JSON chunk into a StreamEvent.
 * Handles both OpenAI chat-completion-chunk objects and Ollama usage-only chunks.
 */
export function normalizeChunk(obj: any): StreamEvent {
  if (obj && Array.isArray(obj.choices)) {
    const choice = obj.choices[0] || {};
    const delta = choice.delta || {};
    const content = typeof delta.content === 'string' ? delta.content : '';
    const event: StreamEvent = {
      kind: 'token',
      content,
      finishReason: choice.finish_reason ?? null,
    };
    if (obj.usage) {
      const usage = extractUsage(obj.usage);
      if (usage) event.usage = usage;
    }
    const ollama = extractOllama(obj.usage ?? obj);
    if (ollama) event.ollama = ollama;
    return event;
  }

  // Ollama final chunk carrying only usage metadata.
  if (obj && obj.usage) {
    const usage = extractUsage(obj.usage);
    const ollama = extractOllama(obj.usage);
    return {
      kind: 'usage',
      usage,
      ollama,
      finishReason: null,
    };
  }

  return { kind: 'finish', finishReason: null };
}

/**
 * Parse newline-delimited SSE/JSON lines into stream events.
 * Only complete lines (terminated by \n) are emitted; anything past the last
 * newline is intentionally left for the caller to retain and reprocess.
 */
export function parseSseLines(buffer: string): StreamEvent[] {
  const events: StreamEvent[] = [];
  const nl = buffer.lastIndexOf('\n');
  if (nl === -1) return events;
  const complete = buffer.slice(0, nl + 1);

  const lines = complete.split('\n');
  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('data:')) {
      line = line.slice(5).trim();
      if (!line) continue;
    }

    if (line === '[DONE]') {
      events.push({ kind: 'finish', finishReason: null });
      continue;
    }

    try {
      events.push(normalizeChunk(JSON.parse(line)));
    } catch {
      // Not valid JSON on its own (e.g. a partial chunk); ignore for now.
    }
  }
  return events;
}

/**
 * Consume only the complete lines from a growing buffer, returning the events
 * parsed so far and the unconsumed remainder to be appended to on the next read.
 */
export function consumeLines(buffer: string): { events: StreamEvent[]; remainder: string } {
  const nl = buffer.lastIndexOf('\n');
  if (nl === -1) return { events: [], remainder: buffer };
  return { events: parseSseLines(buffer), remainder: buffer.slice(nl + 1) };
}
