<script setup lang="ts">
import { reactive, ref } from 'vue'
import ConfigPanel from '@/components/ConfigPanel.vue'
import MetricCards from '@/components/MetricCards.vue'
import SpeedChart from '@/components/SpeedChart.vue'
import ChatOutput from '@/components/ChatOutput.vue'
import SavedRuns from '@/components/SavedRuns.vue'
import RadialGauge from '@/components/RadialGauge.vue'
import { useBenchmark, defaultConfig, DEFAULT_PROMPT, type Config } from '@/composables/useBenchmark'
import { saveRun } from '@/lib/storage'
import { playTokenTick } from '@/lib/audio'
import type { Message } from '@/lib/types'

const config = reactive<Config>({ ...defaultConfig })
const userPrompt = ref(DEFAULT_PROMPT)
const toast = ref<{ message: string; kind: 'ok' | 'err' } | null>(null)
const savedRunsRef = ref<{ refresh: () => void } | null>(null)
const soundEnabled = ref(false)

const { status, text, tokens, result, error, currentTps, peakTps, run, abort } = useBenchmark()

let saveTimer: ReturnType<typeof setTimeout> | null = null

async function onStart() {
  const userContent = userPrompt.value.trim() || config.systemPrompt.trim() || 'Hello'
  const messages: Message[] = [{ role: 'user', content: userContent }]
  await run(config, messages, config.systemPrompt, {
    onToken: (_chunk, liveTps) => {
      if (soundEnabled.value) {
        playTokenTick(liveTps)
      }
    },
  })
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
  setTimeout(() => (toast.value = null), kind === 'err' ? 8000 : 3500)
}
</script>

<template>
  <div class="app">
    <header class="header">
      <span class="logo">🏎️</span>
      <div class="header-content">
        <div class="header-top">
          <h1>LLM Speedometer</h1>
          <span class="badge" style="border-color: #38bdf8; color: #38bdf8;">v0.1.0</span>
          <a
            href="https://github.com/woodongho/LLM-Speedometer"
            target="_blank"
            rel="noopener noreferrer"
            class="header-github-link"
          >
            ⭐ GitHub
          </a>
        </div>
        <div class="sub">
          로컬(Ollama, vLLM, LM Studio) 및 클라우드 LLM의 <strong>첫 토큰 지연 시간(TTFT)</strong>과 <strong>초당 토큰 생성 속도(TPS)</strong>를 실시간 스트리밍으로 정밀 측정하고 시각화하는 오픈소스 벤치마크 도구입니다.
        </div>
      </div>
    </header>

    <aside class="left">
      <ConfigPanel :config="config" :prompt="userPrompt" :running="status === 'running'" @update:config="Object.assign(config, $event)" @update:prompt="userPrompt = $event" @start="onStart" @abort="abort" />
    </aside>

    <main class="center">
      <RadialGauge
        :current-tps="currentTps"
        :peak-tps="peakTps"
        :running="status === 'running'"
        :sound-enabled="soundEnabled"
        @toggle-sound="soundEnabled = !soundEnabled"
      />
      <MetricCards :result="result" />
      <ChatOutput :text="text" :running="status === 'running'" :error="error" />
      <SpeedChart :tokens="tokens" />
    </main>

    <aside class="right">
      <SavedRuns ref="savedRunsRef" />
    </aside>

    <footer class="footer">
      <div class="footer-left">
        <div><strong>LLM Speedometer</strong> · Made with ❤️ by <strong>woodongho</strong></div>
        <div class="footer-desc">OpenAI-compatible streaming speed benchmark for Ollama, vLLM, LM Studio, llama.cpp & Cloud LLMs</div>
      </div>
      <div class="footer-right">
        <a href="https://github.com/woodongho/LLM-Speedometer" target="_blank" rel="noopener noreferrer">GitHub Repo</a>
        <a href="https://github.com/woodongho" target="_blank" rel="noopener noreferrer">@woodongho</a>
        <a href="mailto:uhotax@gmail.com">Contact</a>
      </div>
    </footer>

    <div v-if="toast" class="toast" :class="{ ok: toast.kind === 'ok' }" @click="toast = null" title="클릭하면 닫힙니다">{{ toast.message }}</div>
  </div>
</template>
