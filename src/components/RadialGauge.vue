<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  currentTps: number
  peakTps: number
  running: boolean
  soundEnabled: boolean
}>()

const emit = defineEmits<{
  (e: 'toggleSound'): void
}>()

// Dynamic scale: defaults to 200, expands if TPS or peak exceeds it
const maxScale = computed(() => {
  const highest = Math.max(props.currentTps, props.peakTps, 100)
  if (highest > 300) return 400
  if (highest > 200) return 300
  return 200
})

// Angle ranges from -135deg (0 TPS) to +135deg (maxScale TPS) -> 270 deg total
const needleAngle = computed(() => {
  const ratio = Math.min(Math.max(props.currentTps / maxScale.value, 0), 1)
  return -135 + ratio * 270
})

const peakAngle = computed(() => {
  const ratio = Math.min(Math.max(props.peakTps / maxScale.value, 0), 1)
  return -135 + ratio * 270
})

// SVG arc progress (radius = 90, circumference = 2 * PI * 90 = ~565.48)
// 270 deg arc length = 565.48 * (270/360) = 424.11
const arcCircumference = 424.11
const arcOffset = computed(() => {
  const ratio = Math.min(Math.max(props.currentTps / maxScale.value, 0), 1)
  return arcCircumference * (1 - ratio)
})

// Speed tier for dynamic visual styling
const speedTier = computed(() => {
  const tps = props.currentTps
  if (tps <= 0) return { name: 'IDLE', color: '#9aa7c7', class: 'tier-idle', emoji: '🅿️' }
  if (tps < 40) return { name: 'CRUISING', color: '#38bdf8', class: 'tier-cruise', emoji: '🚗' }
  if (tps < 90) return { name: 'SPORT', color: '#34d399', class: 'tier-sport', emoji: '🏎️' }
  if (tps < 150) return { name: 'RACE', color: '#fbbf24', class: 'tier-race', emoji: '🚀' }
  return { name: 'NITRO', color: '#f43f5e', class: 'tier-nitro', emoji: '🔥' }
})

// Major ticks based on maxScale
const ticks = computed(() => {
  const step = maxScale.value / 4
  return [0, step, step * 2, step * 3, maxScale.value].map((val) => {
    const ratio = val / maxScale.value
    const angle = -135 + ratio * 270
    const rad = (angle - 90) * (Math.PI / 180)
    const r = 90
    const x = 120 + r * Math.cos(rad)
    const y = 120 + r * Math.sin(rad)
    const labelR = 70
    const lx = 120 + labelR * Math.cos(rad)
    const ly = 120 + labelR * Math.sin(rad)
    return { val: Math.round(val), angle, x, y, lx, ly }
  })
})
</script>

<template>
  <section class="card tachometer-card" :class="[speedTier.class, { 'is-running': running }]">
    <div class="tacho-header">
      <div class="tacho-title">
        <span class="speed-pulse-indicator" :class="{ active: running }"></span>
        <span>REAL-TIME TACHOMETER</span>
      </div>
      <div class="tacho-actions">
        <button
          type="button"
          class="sound-toggle-btn"
          :class="{ active: soundEnabled }"
          @click="emit('toggleSound')"
          title="토큰 생성 사운드 피드백 ON/OFF"
        >
          {{ soundEnabled ? '🔊 SFX ON' : '🔇 SFX OFF' }}
        </button>
      </div>
    </div>

    <div class="gauge-container">
      <svg class="gauge-svg" viewBox="0 0 240 200">
        <defs>
          <!-- Dynamic Neon Gradient -->
          <linearGradient id="tachoGradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#38bdf8" />
            <stop offset="35%" stop-color="#34d399" />
            <stop offset="70%" stop-color="#fbbf24" />
            <stop offset="100%" stop-color="#f43f5e" />
          </linearGradient>

          <!-- Glow Filter for Needle -->
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <!-- Background Track Arc (270 deg) -->
        <!-- Center (120, 120), radius 90. Start (-135deg), End (135deg) -->
        <path
          d="M 56.36 183.64 A 90 90 0 1 1 183.64 183.64"
          fill="none"
          stroke="#1b243d"
          stroke-width="12"
          stroke-linecap="round"
        />

        <!-- Animated Progress Track Arc -->
        <path
          d="M 56.36 183.64 A 90 90 0 1 1 183.64 183.64"
          fill="none"
          stroke="url(#tachoGradient)"
          stroke-width="12"
          stroke-linecap="round"
          stroke-dasharray="424.11"
          :stroke-dashoffset="arcOffset"
          class="gauge-progress"
        />

        <!-- Tick Marks and Labels -->
        <g v-for="t in ticks" :key="t.val" class="tick-group">
          <circle :cx="t.x" :cy="t.y" r="2" fill="#6b78a0" />
          <text :x="t.lx" :y="t.ly" text-anchor="middle" dominant-baseline="central" class="tick-text">
            {{ t.val }}
          </text>
        </g>

        <!-- Peak Speed Marker (Tiny Red Dot) -->
        <g v-if="peakTps > 0" :transform="`rotate(${peakAngle} 120 120)`" class="peak-marker">
          <polygon points="116,28 124,28 120,36" fill="#f43f5e" filter="url(#glow)" />
        </g>

        <!-- Needle (Smoothly Animated) -->
        <g :transform="`rotate(${needleAngle} 120 120)`" class="gauge-needle" filter="url(#glow)">
          <polygon points="118,120 122,120 120.8,32 119.2,32" :fill="speedTier.color" />
          <circle cx="120" cy="32" r="2.5" :fill="speedTier.color" />
        </g>

        <!-- Center Pivot Cap -->
        <circle cx="120" cy="120" r="14" fill="#0d1426" stroke="#26304f" stroke-width="3" />
        <circle cx="120" cy="120" r="6" :fill="speedTier.color" />
      </svg>

      <!-- Center Digital Readout Display -->
      <div class="digital-cluster">
        <div class="digital-speed" :style="{ color: speedTier.color }">
          {{ currentTps > 0 ? currentTps.toFixed(1) : '0.0' }}
        </div>
        <div class="digital-unit">TOKENS / SEC</div>
        <div class="digital-meta">
          <span class="mode-badge" :style="{ borderColor: speedTier.color, color: speedTier.color }">
            {{ speedTier.emoji }} {{ speedTier.name }}
          </span>
          <span v-if="peakTps > 0" class="peak-badge" title="이번 실행의 최고 순간 속도">
            ⚡ MAX: {{ peakTps.toFixed(1) }}
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.tachometer-card {
  position: relative;
  overflow: hidden;
  padding: 16px 20px 18px;
  background: linear-gradient(180deg, #101830 0%, #0d1424 100%);
  border: 1px solid var(--border);
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

/* Speed tier dynamic glows */
.tachometer-card.tier-cruise {
  border-color: rgba(56, 189, 248, 0.4);
}
.tachometer-card.tier-sport {
  border-color: rgba(52, 211, 153, 0.5);
  box-shadow: 0 0 25px rgba(52, 211, 153, 0.15);
}
.tachometer-card.tier-race {
  border-color: rgba(251, 191, 36, 0.6);
  box-shadow: 0 0 35px rgba(251, 191, 36, 0.2);
}
.tachometer-card.tier-nitro {
  border-color: rgba(244, 63, 94, 0.8);
  box-shadow: 0 0 45px rgba(244, 63, 94, 0.3);
  animation: nitroPulse 1.5s infinite alternate;
}
@keyframes nitroPulse {
  from { box-shadow: 0 0 25px rgba(244, 63, 94, 0.2); }
  to { box-shadow: 0 0 50px rgba(244, 63, 94, 0.45); }
}

.tacho-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.tacho-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: var(--text-dim);
  text-transform: uppercase;
}

.speed-pulse-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #475569;
}
.speed-pulse-indicator.active {
  background: #34d399;
  box-shadow: 0 0 10px #34d399;
  animation: pulseDot 0.8s infinite ease-in-out;
}
@keyframes pulseDot {
  0%, 100% { transform: scale(0.9); opacity: 0.6; }
  50% { transform: scale(1.3); opacity: 1; }
}

.sound-toggle-btn {
  background: #141d38;
  border: 1px solid var(--border);
  color: var(--text-dim);
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 600;
  transition: all 0.2s ease;
}
.sound-toggle-btn.active {
  background: rgba(56, 189, 248, 0.15);
  border-color: var(--accent);
  color: var(--accent);
}
.sound-toggle-btn:hover {
  filter: brightness(1.2);
}

.gauge-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.gauge-svg {
  width: 100%;
  max-width: 280px;
  height: auto;
  overflow: visible;
}

.gauge-progress {
  transition: stroke-dashoffset 0.18s cubic-bezier(0.4, 0, 0.2, 1);
}

.gauge-needle {
  transition: transform 0.18s cubic-bezier(0.34, 1.3, 0.64, 1);
  transform-origin: 120px 120px;
}

.peak-marker {
  transition: transform 0.3s ease;
  transform-origin: 120px 120px;
}

.tick-text {
  font-size: 10px;
  fill: #6b78a0;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-weight: 600;
}

.digital-cluster {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: -38px;
  z-index: 2;
}

.digital-speed {
  font-size: 42px;
  font-weight: 900;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  line-height: 1;
  letter-spacing: -1px;
  text-shadow: 0 0 16px rgba(0, 0, 0, 0.8);
  transition: color 0.3s ease;
}

.digital-unit {
  font-size: 10px;
  letter-spacing: 1.5px;
  font-weight: 700;
  color: #6b78a0;
  margin-top: 4px;
}

.digital-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.mode-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid currentColor;
  background: rgba(0, 0, 0, 0.3);
  letter-spacing: 0.5px;
}

.peak-badge {
  font-size: 11px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(244, 63, 94, 0.12);
  border: 1px solid rgba(244, 63, 94, 0.4);
  color: #fb7185;
}
</style>
