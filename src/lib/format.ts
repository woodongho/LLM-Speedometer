export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatTps(tps: number | null | undefined): string {
  if (tps == null) return '—';
  return `${tps.toFixed(1)} tok/s`;
}

export function formatTpsLong(tps: number | null | undefined): string {
  if (tps == null) return '—';
  return `${tps.toFixed(2)} tok/s`;
}

export function gaugeColor(value: number | null | undefined): 'ok' | 'warn' | 'bad' | 'neutral' {
  if (value == null) return 'neutral';
  if (value >= 30) return 'ok';
  if (value >= 10) return 'warn';
  return 'bad';
}
