import type { BenchmarkResult, StoredRun } from './types';

const KEY = 'llm-speedometer:runs';
const MAX_RUNS = 100;

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

function readAll(): StoredRun[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r): r is StoredRun => r && typeof r.id === 'string');
  } catch {
    return [];
  }
}

function writeAll(runs: StoredRun[]): StoredRun[] {
  if (!hasStorage()) return [];
  try {
    window.localStorage.setItem(KEY, JSON.stringify(runs.slice(0, MAX_RUNS)));
  } catch {
    // Storage full or unavailable; ignore.
  }
  return runs;
}

export function maskEndpoint(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.length <= 8) return '***';

  // Keep the first half, mask the remaining half with asterisks
  const keepLength = Math.ceil(trimmed.length / 2);
  const maskLength = trimmed.length - keepLength;
  return trimmed.slice(0, keepLength) + '*'.repeat(maskLength);
}

export function saveRun(
  result: BenchmarkResult,
  meta: { label: string; endpoint: string; model: string },
): StoredRun {
  const run: StoredRun = {
    ...result,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    label: meta.label,
    endpoint: maskEndpoint(meta.endpoint),
    model: meta.model,
  };
  const runs = readAll();
  runs.unshift(run);
  writeAll(runs);
  return run;
}

export function listRuns(): StoredRun[] {
  return readAll();
}

export function deleteRun(id: string): StoredRun[] {
  return writeAll(readAll().filter((r) => r.id !== id));
}

export function clearRuns(): StoredRun[] {
  return writeAll([]);
}

export function summarize(result: BenchmarkResult): {
  ttft: string;
  tpot: string;
  tps: string;
  tokens: string;
} {
  return {
    ttft: result.ttftMs == null ? '—' : `${result.ttftMs} ms`,
    tpot: result.tpotMs == null ? '—' : `${result.tpotMs} ms`,
    tps: result.tps == null ? '—' : `${result.tps} tok/s`,
    tokens: `${result.promptTokens} / ${result.completionTokens} / ${result.totalTokens}`,
  };
}
