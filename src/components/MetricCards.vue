<script setup lang="ts">
import { computed } from 'vue'
import type { BenchmarkResult } from '@/lib/types'
import { gaugeColor } from '@/lib/format'

const props = defineProps<{ result: BenchmarkResult | null }>()

const ready = computed(() => !!props.result)

const sourceLabel = computed(() => {
  if (!props.result) return ''
  return props.result.tokenCountSource === 'usage'
    ? ''
    : ' · estimated (endpoint sent no usage)'
})

const cards = computed(() => {
  if (!props.result) return []
  const r = props.result
  return [
    {
      label: 'TTFT',
      sub: 'time to first token',
      value: r.ttftMs == null ? '—' : `${r.ttftMs} ms`,
      color: r.ttftMs == null ? 'neutral' : r.ttftMs < 200 ? 'ok' : r.ttftMs < 800 ? 'warn' : 'bad',
    },
    {
      label: 'TPOT',
      sub: 'per output token',
      value: r.tpotMs == null ? '—' : `${r.tpotMs} ms`,
      color: r.tpotMs == null ? 'neutral' : r.tpotMs > 200 ? 'bad' : r.tpotMs > 100 ? 'warn' : 'ok',
    },
    {
      label: 'TPS',
      sub: 'generation throughput',
      value: r.tps == null ? '—' : `${r.tps} tok/s`,
      color: gaugeColor(r.tps),
    },
    {
      label: 'Tokens',
      sub: `prompt / completion / total${sourceLabel.value}`,
      value: `${r.promptTokens} / ${r.completionTokens} / ${r.totalTokens}`,
      color: 'neutral',
    },
  ]
})
</script>

<template>
  <section class="card">
    <div style="display:flex; justify-content:space-between; align-items:center">
      <h2 class="section-title" style="margin:0">Live Metrics</h2>
      <span v-if="result" class="badge" :class="{ ollama: result.engine === 'ollama' }">
        {{ result.engine }}
      </span>
      <span v-else class="badge">idle</span>
    </div>

    <div class="metrics" style="margin-top: 12px">
      <div
        v-for="c in cards"
        :key="c.label"
        class="metric"
        :class="c.color"
      >
        <div class="label">{{ c.label }}</div>
        <div class="value">{{ c.value }}</div>
        <div class="small muted">{{ c.sub }}</div>
      </div>
    </div>
  </section>
</template>
