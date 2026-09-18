import { describe, it, expect } from 'vitest';
import { parseSseLines } from '@/lib/sse';
import { computeMetrics } from '@/lib/metrics';
import type { StreamEvent } from '@/lib/sse';
import type { TokenEvent } from '@/lib/types';

/** Simulates useBenchmark.lastUsage(): pick the last event carrying usage. */
function lastUsage(events: StreamEvent[]) {
  let last: any;
  for (const e of events) if (e.usage) last = e.usage;
  return last;
}

/** Simulates llm.ts: assign a monotonic timestamp to each emitted token. */
function assignTokens(events: StreamEvent[]): TokenEvent[] {
  const tokens: TokenEvent[] = [];
  let idx = 0;
  let clock = -100;
  for (const e of events) {
    if (e.kind === 'token' && e.content) {
      clock += 100; // 100ms per token
      tokens.push({ index: idx++, content: e.content, ts: clock });
    }
  }
  return tokens;
}

describe('usage flow - endpoint sends usage is accurately reflected', () => {
  it('end-to-end: parsed usage drives exact token counts', () => {
    const stream =
      'data: {"choices":[{"delta":{"content":"한"}}]}\n' +
      'data: {"choices":[{"delta":{"content":"국"}}]}\n' +
      'data: {"choices":[{"delta":{"content":"어"}}],"finish_reason":"stop"}\n' +
      'data: {"usage":{"prompt_tokens":137,"completion_tokens":3,"total_tokens":140}}\n';

    const events = parseSseLines(stream);
    const tokens = assignTokens(events);
    const usage = lastUsage(events);

    const r = computeMetrics({ tokens, usage });

    expect(r.promptTokens).toBe(137);
    expect(r.completionTokens).toBe(3);
    expect(r.totalTokens).toBe(140);
    expect(r.tokenCountSource).toBe('usage');
    // timing still measured independently (tokens at ts 0,100,200)
    expect(r.ttftMs).toBe(0);
    expect(r.tpotMs).toBe(100);
    expect(r.tps).toBe(15); // 3 tokens / 200ms
  });

  it('without usage, falls back to estimate (prompt=0)', () => {
    const stream =
      'data: {"choices":[{"delta":{"content":"a"}}]}\n' +
      'data: {"choices":[{"delta":{"content":"b"}}]}\n';
    const events = parseSseLines(stream);
    const tokens = assignTokens(events);
    const r = computeMetrics({ tokens, usage: lastUsage(events) });
    expect(r.promptTokens).toBe(0);
    expect(r.completionTokens).toBe(2);
    expect(r.tokenCountSource).toBe('estimated');
  });

  it('handles an Ollama endpoint that sends eval metadata', () => {
    const stream =
      '{"choices":[{"delta":{"content":"x"}}]}\n' +
      '{"choices":[{"delta":{"content":"y"}}]}\n' +
      '{"usage":{"prompt_eval_count":64,"eval_count":2,"eval_duration":15000000}}\n';
    const events = parseSseLines(stream);
    const tokens = assignTokens(events);
    const last = events.filter((e) => e.ollama).pop();
    const r = computeMetrics({ tokens, ollama: last?.ollama });
    expect(r.promptTokens).toBe(64);
    expect(r.completionTokens).toBe(2);
    expect(r.tokenCountSource).toBe('usage');
    expect(r.engine).toBe('ollama');
  });
});
