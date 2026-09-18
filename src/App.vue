<script setup lang="ts">
import { reactive, ref } from 'vue'
import ConfigPanel from '@/components/ConfigPanel.vue'
import MetricCards from '@/components/MetricCards.vue'
import SpeedChart from '@/components/SpeedChart.vue'
import ChatOutput from '@/components/ChatOutput.vue'
import SavedRuns from '@/components/SavedRuns.vue'
import { useBenchmark, defaultConfig, type Config } from '@/composables/useBenchmark'
import { saveRun } from '@/lib/storage'
import type { Message } from '@/lib/types'

const config = reactive<Config>({ ...defaultConfig })
const userPrompt = ref('')
const toast = ref<{ message: string; kind: 'ok' | 'err' } | null>(null)
const savedRunsRef = ref<{ refresh: () => void } | null>(null)

const { status, text, tokens, result, error, run, abort } = useBenchmark()

let saveTimer: ReturnType<typeof setTimeout> | null = null

async function onStart() {
  const userContent = userPrompt.value.trim() || config.systemPrompt.trim() || 'Hello'
  const messages: Message[] = [{ role: 'user', content: userContent }]
  await run(config, messages, config.systemPrompt)
  savedRunsRef.value?.refresh()

  if (result.value && status.value !== 'error') {
    // Debounce save so a fast stream does not write 100 times.
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const run_ = saveRun(result.value!, {
        label: config.model || 'benchmark',
        endpoint: config.endpoint,
        model: config.model,
      })
      showToast(`Saved: ${run_.model || 'benchmark'} — ${run_.tps ?? 0} tok/s`, 'ok')
    }, 400)
  } else if (error.value) {
    showToast(error.value, 'err')
  }
}

function showToast(message: string, kind: 'ok' | 'err') {
  toast.value = { message, kind }
  setTimeout(() => (toast.value = null), 3500)
}
</script>

<template>
  <div class="app">
    <header class="header">
      <span class="logo">🏎️</span>
      <div>
        <h1>LLM Speedometer</h1>
        <div class="sub">Benchmark local LLM speed via an OpenAI-compatible streaming API</div>
      </div>
    </header>

    <aside class="left">
      <ConfigPanel :config="config" :prompt="userPrompt" :running="status === 'running'" @update:config="Object.assign(config, $event)" @update:prompt="userPrompt = $event" @start="onStart" @abort="abort" />
    </aside>

    <main class="center">
      <MetricCards :result="result" />
      <ChatOutput :text="text" :running="status === 'running'" />
      <SpeedChart :tokens="tokens" />
    </main>

    <aside class="right">
      <SavedRuns ref="savedRunsRef" />
    </aside>

    <div v-if="toast" class="toast" :class="{ ok: toast.kind === 'ok' }">{{ toast.message }}</div>
  </div>
</template>
