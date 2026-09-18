import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { EngineType } from '@/lib/types';

// Minimal in-memory localStorage polyfill
class MemoryStorage {
  store: Record<string, string> = {};
  getItem(k: string) { return k in this.store ? this.store[k] : null; }
  setItem(k: string, v: string) { this.store[k] = String(v); }
  removeItem(k: string) { delete this.store[k]; }
  clear() { this.store = {}; }
}

let mem: MemoryStorage
beforeEach(() => {
  mem = new MemoryStorage();
  vi.stubGlobal('window', { localStorage: mem, crypto: { randomUUID: () => 'id-' + Math.random() } });
  vi.stubGlobal('crypto', { randomUUID: () => 'id-' + Math.random() });
});

const mod = await import('@/lib/storage');
const KEY = 'llm-speedometer:runs';

function mkRun(overrides: Record<string, unknown> = {}) {
  return {
    engine: 'unknown' as EngineType,
    ttftMs: 10, tpotMs: 1, tps: 100, effectiveTps: 90,
    generationDurationMs: 100, totalDurationMs: 110,
    promptTokens: 5, completionTokens: 10, totalTokens: 15, tokenCountSource: 'usage' as const,
    promptEvalMs: null, promptTps: null, ollamaTps: null,
    rawText: 'hello world', ollama: undefined, errors: [],
    ...overrides,
  };
}

describe('storage save/list', () => {
  it('saves a run and lists it', () => {
    const r = mod.saveRun(mkRun(), { label: 'llama3.1', endpoint: 'http://x', model: 'llama3.1' });
    expect(r.id).toBeTruthy();
    const list = mod.listRuns();
    expect(list).toHaveLength(1);
    expect(list[0].model).toBe('llama3.1');
    expect(list[0].promptTokens).toBe(5);
    // persisted raw in localStorage
    expect(JSON.parse(mem.getItem(KEY) as string)).toHaveLength(1);
  });

  it('keeps newest first', () => {
    mod.saveRun(mkRun({ completionTokens: 1 }), { label: 'a', endpoint: 'e', model: 'a' });
    mod.saveRun(mkRun({ completionTokens: 2 }), { label: 'b', endpoint: 'e', model: 'b' });
    expect(mod.listRuns().map((r) => r.label)).toEqual(['b', 'a']);
  });
});

describe('storage delete/clear', () => {
  it('deletes a single run and re-reads', () => {
    const a = mod.saveRun(mkRun(), { label: 'a', endpoint: 'e', model: 'a' });
    mod.saveRun(mkRun(), { label: 'b', endpoint: 'e', model: 'b' });
    mod.deleteRun(a.id);
    const list = mod.listRuns();
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe('b');
  });

  it('clears all', () => {
    mod.saveRun(mkRun(), { label: 'a', endpoint: 'e', model: 'a' });
    mod.clearRuns();
    expect(mod.listRuns()).toHaveLength(0);
    expect(JSON.parse(mem.getItem(KEY) as string)).toEqual([]);
  });
});

describe('summarize', () => {
  it('formats tokens as prompt / completion / total', () => {
    const s = mod.summarize(mkRun({ promptTokens: 3, completionTokens: 4, totalTokens: 7 }));
    expect(s.tokens).toBe('3 / 4 / 7');
  });
});
