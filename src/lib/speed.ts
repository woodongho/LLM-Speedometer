import type { TokenEvent } from './types';

/** Default trailing window (ms) over which TPS is averaged. */
export const SPEED_WINDOW_MS = 1000;

export interface SpeedSeries {
  labels: number[];
  data: (number | null)[];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Build a tokens/sec time series from token timestamps using a trailing
 * sliding window.
 *
 * The naive instantaneous rate (1000 / dt between two consecutive tokens)
 * produces absurd peaks whenever network buffering delivers a burst of tokens
 * within a sub-millisecond dt (e.g. 10,000 tok/s). Instead we count how many
 * tokens arrived inside the last `windowMs` and divide by the window span,
 * which yields a smooth, realistic real-time throughput curve.
 */
export function buildSpeedSeries(
  tokens: TokenEvent[],
  windowMs: number = SPEED_WINDOW_MS,
): SpeedSeries {
  if (tokens.length === 0) return { labels: [], data: [] };

  const sorted = [...tokens].sort((a, b) => a.ts - b.ts);
  const labels: number[] = [];
  const data: (number | null)[] = [];

  let startIdx = 0;
  for (let i = 0; i < sorted.length; i++) {
    const tEnd = sorted[i].ts;
    const threshold = tEnd - windowMs;
    while (startIdx < i && sorted[startIdx].ts < threshold) {
      startIdx++;
    }
    // Tokens whose timestamp falls inside the trailing window.
    const count = i - startIdx + 1;
    // Span covered so far: the full window once we are past it, else elapsed time.
    const spanMs = Math.min(tEnd, windowMs);
    const tps = spanMs > 0 ? (count * 1000) / spanMs : 0;

    labels.push(Math.round(tEnd));
    data.push(round1(tps));
  }

  return { labels, data };
}
