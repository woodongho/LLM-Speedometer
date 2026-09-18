<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { Chart, registerables } from 'chart.js'
import type { TokenEvent } from '@/lib/types'
import { round } from '@/lib/metrics'

Chart.register(...registerables)

const props = defineProps<{ tokens: TokenEvent[] }>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

// Build evenly-spaced speed samples (tokens/sec) from token timestamps.
function buildSeries(tokens: TokenEvent[]) {
  if (tokens.length < 2) return { labels: [], data: [] as (number | null)[] }
  const sorted = [...tokens].sort((a, b) => a.ts - b.ts)
  const labels: number[] = []
  const data: (number | null)[] = []
  for (let i = 1; i < sorted.length; i++) {
    const dt = sorted[i].ts - sorted[i - 1].ts
    const tps = dt > 0 ? (1000 * 1) / dt : null
    labels.push(Math.round(sorted[i].ts))
    data.push(tps == null ? null : round(tps, 1))
  }
  return { labels, data }
}

const lineOptions: Chart['options'] = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
  scales: {
    x: { title: { display: true, text: 'elapsed (ms)' }, ticks: { color: '#9aa7c7' }, grid: { color: '#20293f' } },
    y: { beginAtZero: true, title: { display: true, text: 'tok/s' }, ticks: { color: '#9aa7c7' }, grid: { color: '#20293f' } },
  },
}

function render(tokens: TokenEvent[]) {
  if (!canvasRef.value) return
  const { labels, data } = buildSeries(tokens)
  if (!chart) {
    chart = new Chart(canvasRef.value, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Tokens/sec', data, borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.12)', fill: true, tension: 0.25, pointRadius: 2, borderWidth: 2 }] },
      options: lineOptions,
    })
    return
  }
  chart.data.labels = labels
  chart.data.datasets[0].data = data
  chart.update()
}

watch(() => props.tokens, (t) => render(t), { deep: true })

onMounted(() => {
  if (canvasRef.value && !chart) {
    chart = new Chart(canvasRef.value, {
      type: 'line',
      data: { labels: [], datasets: [{ label: 'Tokens/sec', data: [], borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.12)', fill: true, tension: 0.25, pointRadius: 2, borderWidth: 2 }] },
      options: lineOptions,
    })
  }
})

onBeforeUnmount(() => { chart?.destroy(); chart = null })
</script>

<template>
  <section class="card">
    <h2 class="section-title" style="margin-bottom:10px">Live Speed Graph</h2>
    <div class="chart-wrap">
      <canvas ref="canvasRef"></canvas>
    </div>
    <p v-if="tokens.length < 2" class="small muted" style="margin-top:8px">
      Stream a response to watch token speed update in real time.
    </p>
  </section>
</template>
