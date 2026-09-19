import { describe, it, expect } from 'vitest';
import { buildSpeedSeries, SPEED_WINDOW_MS } from '@/lib/speed';
import type { TokenEvent } from '@/lib/types';

function ts(times: number[]): TokenEvent[] {
  return times.map((ts, i) => ({ index: i, content: 'x', ts }));
}

describe('buildSpeedSeries - empty / single', () => {
  it('returns empty for no tokens', () => {
    expect(buildSpeedSeries([])).toEqual({ labels: [], data: [] });
  });

  it('returns a single finite point for one token (no Infinity/NaN)', () => {
    const { labels, data } = buildSpeedSeries(ts([1800]));
    expect(labels).toEqual([1800]);
    expect(data).toHaveLength(1);
    expect(Number.isFinite(data[0] as number)).toBe(true);
  });
});

describe('buildSpeedSeries - steady state does not spike', () => {
  it('holds ~100 tok/s for tokens 10ms apart (no 10,000 peaks)', () => {
    const times = Array.from({ length: 200 }, (_, i) => i * 10); // 0..1990ms
    const { data } = buildSpeedSeries(ts(times));
    const settled = data.slice(150);
    for (const v of settled) {
      expect(v).not.toBeNull();
      expect(v as number).toBeGreaterThanOrEqual(90);
      expect(v as number).toBeLessThanOrEqual(112);
    }
    expect(Math.max(...data.filter((v): v is number => v !== null))).toBeLessThan(300);
  });
});

describe('buildSpeedSeries - burst buffering is smoothed', () => {
  it('caps a buffer-flush burst instead of spiking to infinity', () => {
    const steady = Array.from({ length: 500 }, (_, i) => i * 10);
    const burst = Array.from({ length: 200 }, () => 5000);
    const { data } = buildSpeedSeries(ts([...steady, ...burst]));
    expect(Math.max(...data.filter((v): v is number => v !== null))).toBeLessThan(500);
  });
});

describe('buildSpeedSeries - respects window size', () => {
  it('uses the provided window (ms): wider window -> lower averaged rate', () => {
    expect(SPEED_WINDOW_MS).toBe(1000);
    const events = ts(Array.from({ length: 100 }, () => 2000));
    const narrow = buildSpeedSeries(events, 1000).data.at(-1) as number; // 100/1000ms
    const wide = buildSpeedSeries(events, 5000).data.at(-1) as number;   // 100/2000ms
    expect(narrow).toBeCloseTo(100, 5);
    expect(wide).toBeCloseTo(50, 5);
    expect(narrow).toBeGreaterThan(wide);
  });
});
