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

describe('computeMetrics - two tokens', () => {
  it('computes TTFT, one inter-token interval, TPS, and effective TPS', () => {
    const r = computeMetrics({ tokens: toks([0, 200], ['H', 'i']) });
    expect(r.ttftMs).toBe(0);
    expect(r.completionTokens).toBe(2);
    expect(r.generationDurationMs).toBe(200);
    expect(r.tpotMs).toBe(200); // one 200ms interval
    expect(r.tps).toBe(10); // 2 tokens / 200ms
    expect(r.effectiveTps).toBe(10);
  });
});

describe('computeMetrics - single token', () => {
  it('leaves TPOT and generation TPS undefined', () => {
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
    const r = computeMetrics({ tokens: toks([0, 100, 100, 400], ['a', 'b', 'c', 'd']) });
    expect(r.completionTokens).toBe(4);
    expect(r.generationDurationMs).toBe(400);
    expect(r.tpotMs).toBe(133.33); // 400 / 3
    expect(r.tps).toBe(10); // 4 tokens / 400ms
    expect(r.effectiveTps).toBe(10);
  });

  it('handles out-of-order timestamps by sorting', () => {
    const r = computeMetrics({
      tokens: [
        { index: 0, content: 'a', ts: 400 },
        { index: 1, content: 'b', ts: 0 },
        { index: 2, content: 'c', ts: 200 },
      ],
    });
    expect(r.ttftMs).toBe(400);
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

describe('computeMetrics - ollama-derived metrics', () => {
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
});
