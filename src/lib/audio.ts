/**
 * Web Audio API synthesizer for dynamic LLM generation feedback.
 * Produces crisp, satisfying audio ticks whose pitch scales with TPS.
 */

let audioCtx: AudioContext | null = null;
let lastTickTime = 0;

export function playTokenTick(tps = 50): void {
  try {
    const now = performance.now();
    // Throttle sound to max ~25 ticks/sec to prevent audio clipping & ear fatigue
    if (now - lastTickTime < 38) return;
    lastTickTime = now;

    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    // Scale pitch from ~380Hz to ~1100Hz based on current TPS
    const clampedTps = Math.max(0, Math.min(tps, 250));
    const baseFreq = 380 + clampedTps * 2.8;

    osc.type = clampedTps > 100 ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(baseFreq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, audioCtx.currentTime + 0.02);

    // Dynamic volume (quiet and non-intrusive)
    const vol = clampedTps > 100 ? 0.035 : 0.025;
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.024);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.025);
  } catch {
    // Gracefully ignore audio errors (e.g. autoplay restrictions)
  }
}
