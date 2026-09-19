import { describe, it, expect } from 'vitest';
import {
  parseSseLines,
  consumeLines,
  normalizeChunk,
  extractUsage,
  extractOllama,
} from '@/lib/sse';

describe('extractUsage', () => {
  it('returns undefined when no numeric fields', () => {
    expect(extractUsage({})).toBeUndefined();
  });
  it('extracts all three fields', () => {
    expect(extractUsage({ prompt_tokens: 3, completion_tokens: 5, total_tokens: 8 })).toEqual({
      prompt_tokens: 3,
      completion_tokens: 5,
      total_tokens: 8,
    });
  });
});

describe('extractOllama', () => {
  it('returns undefined when no ollama keys present', () => {
    expect(extractOllama({ choices: [] })).toBeUndefined();
  });
  it('extracts ollama metrics', () => {
    expect(
      extractOllama({ prompt_eval_count: 10, eval_count: 4, eval_duration: 123 }),
    ).toEqual({
      prompt_eval_count: 10,
      eval_count: 4,
      eval_duration: 123,
      prompt_eval_duration: undefined,
    });
  });
});

describe('normalizeChunk', () => {
  it('parses an OpenAI content delta', () => {
    const ev = normalizeChunk({
      choices: [{ index: 0, delta: { content: 'Hello' } }],
    });
    expect(ev.kind).toBe('token');
    expect(ev.content).toBe('Hello');
  });

  it('captures finish_reason', () => {
    const ev = normalizeChunk({
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    });
    expect(ev.kind).toBe('token');
    expect(ev.finishReason).toBe('stop');
  });

  it('captures usage inside a chunk', () => {
    const ev = normalizeChunk({
      choices: [{ index: 0, delta: { content: 'x' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
    expect(ev.usage).toEqual({ prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 });
  });

  it('parses delta.text or message.content', () => {
    const ev1 = normalizeChunk({ choices: [{ delta: { text: 'alt1' } }] });
    expect(ev1.content).toBe('alt1');
    const ev2 = normalizeChunk({ choices: [{ message: { content: 'alt2' } }] });
    expect(ev2.content).toBe('alt2');
  });

  it('parses Ollama native chunk without choices', () => {
    const ev = normalizeChunk({ message: { content: 'ollama text' }, done: false });
    expect(ev.kind).toBe('token');
    expect(ev.content).toBe('ollama text');
  });

  it('parses an Ollama usage-only chunk', () => {
    const ev = normalizeChunk({ usage: { prompt_eval_count: 9, eval_count: 3 } });
    expect(ev.kind).toBe('usage');
    expect(ev.ollama?.eval_count).toBe(3);
  });
});

describe('parseSseLines - OpenAI format', () => {
  it('parses data-prefixed JSON lines', () => {
    const buf =
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n' +
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n';
    const events = parseSseLines(buf);
    expect(events.filter((e) => e.kind === 'token')).toHaveLength(2);
    expect(events.map((e) => e.content).join('')).toBe('Hello');
  });

  it('recognizes [DONE]', () => {
    const events = parseSseLines('data: [DONE]\n');
    expect(events).toEqual([{ kind: 'finish', finishReason: null }]);
  });

  it('ignores empty lines', () => {
    const events = parseSseLines('\n\ndata: {"choices":[{"delta":{"content":"a"}}]}\n\n');
    expect(events).toHaveLength(1);
  });

  it('returns no events for a partial first line', () => {
    const events = parseSseLines('data: {"choices":[{"delta":{"content":"un');
    expect(events).toHaveLength(0);
  });

  it('ignores malformed JSON lines', () => {
    const events = parseSseLines('not json at all\ndata: {"choices":[{"delta":{"content":"a"}}]}\n');
    expect(events).toHaveLength(1);
    expect(events[0].content).toBe('a');
  });
});

describe('parseSseLines - Ollama format (no data: prefix)', () => {
  it('parses raw JSON lines plus trailing usage', () => {
    const buf =
      '{"choices":[{"delta":{"content":"Hi"}}]}\n' +
      '{"choices":[{"delta":{"content":" there"}}]}\n' +
      '{"usage":{"prompt_eval_count":5,"eval_count":2,"eval_duration":1000000}}\n';
    const events = parseSseLines(buf);
    const tokens = events.filter((e) => e.kind === 'token');
    expect(tokens).toHaveLength(2);
    expect(tokens.map((e) => e.content).join('')).toBe('Hi there');
    const usage = events.find((e) => e.kind === 'usage');
    expect(usage?.ollama?.eval_count).toBe(2);
  });
});

describe('consumeLines', () => {
  it('keeps the trailing partial line in the remainder', () => {
    const buf =
      'data: {"choices":[{"delta":{"content":"a"}}]}\n' +
      'data: {"choices":[{"delta":{"content":"b"}}]}\n' +
      'pc';
    const { events, remainder } = consumeLines(buf);
    expect(events).toHaveLength(2);
    expect(remainder).toBe('pc');
  });

  it('returns empty events for a single incomplete buffer', () => {
    const { events, remainder } = consumeLines('partial');
    expect(events).toHaveLength(0);
    expect(remainder).toBe('partial');
  });

  it('is a no-op for an empty buffer', () => {
    const { events, remainder } = consumeLines('');
    expect(events).toHaveLength(0);
    expect(remainder).toBe('');
  });
});

describe('integration: full stream reassembly', () => {
  it('reassembles content split across chunk boundaries', () => {
    const raw =
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n' +
      'data: {"choices":[{"delta":{"content":"lo, wor"}}]}\n' +
      'data: {"choices":[{"delta":{"content":"ld"}}]}\n';
    let buffer = '';
    let assembled = '';
    for (let i = 0; i < raw.length; i += 4) {
      buffer += raw.slice(i, i + 4);
      const { events, remainder } = consumeLines(buffer);
      buffer = remainder;
      for (const e of events) if (e.kind === 'token' && e.content) assembled += e.content;
    }
    expect(assembled).toBe('Hello, world');
  });
});

describe('parseSseLines - usage chunks', () => {
  it('extracts usage embedded in a choice chunk', () => {
    const buf =
      'data: {"choices":[{"delta":{"content":"Hi"}}]}\n' +
      'data: {"choices":[{"delta":{"content":"!"}}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n';
    const events = parseSseLines(buf);
    const usageEvent = events.find((e) => e.usage);
    expect(usageEvent).toBeDefined();
    expect(usageEvent!.usage).toEqual({
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    });
  });

  it('parses a usage-only final chunk (OpenAI style)', () => {
    const events = parseSseLines('data: {"usage":{"prompt_tokens":7,"completion_tokens":3}}\n');
    const usageEvent = events.find((e) => e.kind === 'usage');
    expect(usageEvent).toBeDefined();
    expect(usageEvent!.usage?.completion_tokens).toBe(3);
  });

  it('parses an Ollama usage-only chunk with eval metadata', () => {
    const events = parseSseLines(
      '{"usage":{"prompt_eval_count":20,"eval_count":8,"eval_duration":2000000000}}\n',
    );
    const usageEvent = events.find((e) => e.kind === 'usage');
    expect(usageEvent).toBeDefined();
    expect(usageEvent!.ollama?.eval_count).toBe(8);
    expect(usageEvent!.usage?.completion_tokens).toBeUndefined();
  });

  it('keeps the last usage seen across multiple usage chunks', () => {
    const buf =
      'data: {"usage":{"prompt_tokens":1,"completion_tokens":1}}\n' +
      'data: {"choices":[{"delta":{"content":"x"}}]}\n' +
      'data: {"usage":{"prompt_tokens":50,"completion_tokens":25,"total_tokens":75}}\n';
    const events = parseSseLines(buf);
    const usages = events.filter((e) => e.usage);
    expect(usages).toHaveLength(2);
    const last = usages[usages.length - 1];
    expect(last!.usage?.completion_tokens).toBe(25);
  });

  it('ignores a chunk whose usage has no numeric fields', () => {
    const events = parseSseLines('data: {"usage":{}}\n');
    expect(events.some((e) => e.usage)).toBe(false);
  });
});
