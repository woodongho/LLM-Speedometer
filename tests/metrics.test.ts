import { describe, it, expect } from 'vitest';
import { computeMetrics, round } from '@/lib/metrics';
import type { TokenEvent } from '@/lib/types';

function toks(times: number[], contents: string[]): TokenEvent[] {
  return times.map((ts, i) => ({ index: i, content: contents[i] ?? '', ts }));
}

describe('round', () => {
  it('rounds to a fixed number of decimals', () => {
    expect(round(1.23456, 2)).toBe(1.23);
    expect(round(1.5, 0)).toBe(2);
    expect(round(null)).toBeNull();
    expect(round(undefined)).toBeNull();
    expect(round(Number.NaN)).toBeNull();
  });
});

describe('computeMetrics - empty', () => {
  it('reports no tokens and null timings', () => {
    const r = computeMetrics({ tokens: [] });
    expect(r.completionTokens).toBe(0);
    expect(r.ttftMs).toBeNull();
    expect(r.tpotMs).toBeNull();
    expect(r.tps).toBeNull();
    expect(r.effectiveTps).toBeNull();
    expect(r.tokenCountSource).toBe('none');
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.rawText).toBe('');
  });
});

describe('computeMetrics - single token', () => {
  it('computes TTFT and a single inter-token interval', () => {
    const r = computeMetrics({ tokens: toks([0, 200], ['H', 'i']) });
    expect(r.ttftMs).toBe(0);
    expect(r.completionTokens).toBe(2);
    expect(r.generationDurationMs).toBe(200);
    expect(r.tpotMs).toBe(200); // one 200ms interval
    expect(r.tps).toBe(10); // 2 tokens / 200ms
    expect(r.effectiveTps).toBe(10);
  });

  it('single token leaves generation TPS undefined', () => {
    const r = computeMetrics({ tokens: toks([0], ['H']) });
    expect(r.ttftMs).toBe(0);
    expect(r.tpotMs).toBeNull();
    expect(r.tps).toBeNull();
    expect(r.completionTokens).toBe(1);
    expect(r.errors.some((e) => /single token/i.test(e))).toBe(true);
  });
});

describe('computeMetrics - multiple tokens', () => {
  it('computes TPOT as the average inter-token interval', () => {
    // tokens at 0, 100, 100, 400 ms
    const r = computeMetrics({ tokens: toks([0, 100, 100, 400], ['a', 'b', 'c', 'd']) });
    expect(r.completionTokens).toBe(4);
    expect(r.generationDurationMs).toBe(400);
    expect(r.tpotMs).toBe(133.33); // 400ms / 3 intervals
    // TPS over decode phase: 4 tokens / 400ms = 10 tok/s
    expect(r.tps).toBe(10);
    expect(r.effectiveTps).toBe(10);
  });

  it('uses arrival order for TTFT but sorted span for generation duration', () => {
    const r = computeMetrics({
      tokens: [
        { index: 0, content: 'a', ts: 400 },
        { index: 1, content: 'b', ts: 0 },
        { index: 2, content: 'c', ts: 200 },
      ],
    });
    // TTFT is the first token that arrived (index 0 -> 400ms)
    expect(r.ttftMs).toBe(400);
    // Decode span is min..max across all tokens
    expect(r.generationDurationMs).toBe(400);
    expect(r.tpotMs).toBe(200);
  });
});

describe('computeMetrics - token counts', () => {
  it('prefers OpenAI usage when provided', () => {
    const r = computeMetrics({
      tokens: toks([0, 50], ['a', 'b']),
      usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 },
    });
    expect(r.promptTokens).toBe(12);
    expect(r.completionTokens).toBe(7);
    expect(r.totalTokens).toBe(19);
    expect(r.tokenCountSource).toBe('usage');
  });

  it('uses Ollama usage when no OpenAI usage present', () => {
    const r = computeMetrics({
      tokens: toks([0, 50], ['a', 'b']),
      ollama: { prompt_eval_count: 30, eval_count: 8, eval_duration: 1_000_000_000 },
    });
    expect(r.promptTokens).toBe(30);
    expect(r.completionTokens).toBe(8);
    expect(r.engine).toBe('ollama');
    expect(r.tokenCountSource).toBe('usage');
  });

  it('estimates token count from emitted content', () => {
    const r = computeMetrics({ tokens: toks([0, 10, 20], ['Hello', ' ', 'world']) });
    expect(r.completionTokens).toBe(3);
    expect(r.tokenCountSource).toBe('estimated');
  });

  it('counts code points, not surrogate pairs, as tokens', () => {
    const r = computeMetrics({ tokens: toks([0, 10], ['😀', 'x']) });
    expect(r.completionTokens).toBe(2);
  });
});

describe('computeMetrics - Ollama metadata', () => {
  it('derives prompt eval time and throughput', () => {
    const r = computeMetrics({
      tokens: toks([0, 100, 200], ['a', 'b', 'c']),
      ollama: {
        prompt_eval_count: 100,
        eval_count: 3,
        prompt_eval_duration: 250_000_000, // 250ms
        eval_duration: 300_000_000, // 300ms
      },
    });
    expect(r.promptEvalMs).toBe(250);
    expect(r.promptTps).toBe(400); // 100 / 0.25s
    expect(r.ollamaTps).toBe(10); // 3 / 0.3s
  });

  it('ignores missing Ollama durations', () => {
    const r = computeMetrics({
      tokens: toks([0, 100], ['a', 'b']),
      ollama: { prompt_eval_count: 5, eval_count: 2 },
    });
    expect(r.promptEvalMs).toBeNull();
    expect(r.promptTps).toBeNull();
    expect(r.ollamaTps).toBeNull();
  });
});

describe('computeMetrics - error reporting', () => {
  it('flags sub-millisecond generation', () => {
    const r = computeMetrics({ tokens: toks([0, 0], ['a', 'b']) });
    expect(r.tps).toBeNull();
    expect(r.errors.some((e) => /same millisecond/i.test(e))).toBe(true);
  });

  it('falls back to estimate when no content emitted', () => {
    const r = computeMetrics({ tokens: toks([0, 10], ['', '']) });
    expect(r.completionTokens).toBe(2);
    expect(r.tokenCountSource).toBe('estimated');
    expect(r.errors.some((e) => /estimate/i.test(e))).toBe(true);
  });
});


describe('computeMetrics - usage (endpoint sends usage)', () => {
  it('reflects usage prompt/completion/total exactly', () => {
    const r = computeMetrics({
      tokens: toks([0, 10, 20], ['a', 'b', 'c']),
      usage: { prompt_tokens: 42, completion_tokens: 17, total_tokens: 59 },
    });
    expect(r.promptTokens).toBe(42);
    expect(r.completionTokens).toBe(17);
    expect(r.totalTokens).toBe(59);
    expect(r.tokenCountSource).toBe('usage');
  });

  it('uses explicit total_tokens even if it differs from the sum', () => {
    const r = computeMetrics({
      tokens: toks([0, 10], ['a', 'b']),
      usage: { prompt_tokens: 100, completion_tokens: 5, total_tokens: 108 },
    });
    expect(r.totalTokens).toBe(108);
    expect(r.promptTokens).toBe(100);
    expect(r.completionTokens).toBe(5);
  });

  it('defaults total to prompt+completion when total omitted', () => {
    const r = computeMetrics({
      tokens: toks([0, 10], ['a', 'b']),
      usage: { prompt_tokens: 8, completion_tokens: 4 },
    });
    expect(r.totalTokens).toBe(12);
  });

  it('handles completion-only usage (prompt defaults to 0)', () => {
    const r = computeMetrics({
      tokens: toks([0, 10], ['a', 'b']),
      usage: { completion_tokens: 30 },
    });
    expect(r.promptTokens).toBe(0);
    expect(r.completionTokens).toBe(30);
    expect(r.totalTokens).toBe(30);
  });

  it('prefers usage over ollama metadata when both present', () => {
    const r = computeMetrics({
      tokens: toks([0, 10], ['a', 'b']),
      usage: { prompt_tokens: 11, completion_tokens: 22, total_tokens: 33 },
      ollama: { prompt_eval_count: 999, eval_count: 999 },
    });
    expect(r.promptTokens).toBe(11);
    expect(r.completionTokens).toBe(22);
    expect(r.tokenCountSource).toBe('usage');
  });

  it('falls back to ollama counts when no OpenAI usage', () => {
    const r = computeMetrics({
      tokens: toks([0, 10], ['a', 'b']),
      ollama: { prompt_eval_count: 30, eval_count: 12 },
    });
    expect(r.promptTokens).toBe(30);
    expect(r.completionTokens).toBe(12);
    expect(r.tokenCountSource).toBe('usage');
    expect(r.engine).toBe('ollama');
  });

  it('never uses estimate when usage is present', () => {
    const r = computeMetrics({
      tokens: toks([0, 10, 20, 30], ['a', 'b', 'c', 'd']),
      usage: { prompt_tokens: 3, completion_tokens: 9 },
    });
    // 4 content tokens exist but usage says 9 -> usage wins
    expect(r.completionTokens).toBe(9);
    expect(r.tokenCountSource).toBe('usage');
  });

  it('clamps negative usage counts to zero', () => {
    const r = computeMetrics({
      tokens: toks([0, 10], ['a', 'b']),
      usage: { prompt_tokens: -5, completion_tokens: 4 },
    });
    expect(r.promptTokens).toBe(0);
    expect(r.completionTokens).toBe(4);
  });
});
