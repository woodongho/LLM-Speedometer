<script setup lang="ts">
import { computed } from 'vue'
import { defaultConfig, type Config } from '@/composables/useBenchmark'

const props = defineProps<{
  config: Config
  prompt: string
  running: boolean
}>()

const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
const isMixedContent = computed(() => {
  return isHttps && props.config.endpoint.trim().toLowerCase().startsWith('http:')
})

function updatePrompt(e: Event) {
  emit('update:prompt', (e.target as HTMLTextAreaElement).value)
}

const emit = defineEmits<{
  (e: 'update:config', config: Config): void
  (e: 'update:prompt', value: string): void
  (e: 'start'): void
  (e: 'abort'): void
}>()

function text(key: keyof Config) {
  return (e: Event) => update(key, (e.target as HTMLInputElement).value)
}

function num(key: keyof Config) {
  return (e: Event) => update(key, Number((e.target as HTMLInputElement).value) || 0)
}

function update(key: keyof Config, value: string | number) {
  emit('update:config', { ...props.config, [key]: value } as Config)
}
</script>

<template>
  <section class="card">
    <h2 class="section-title">Engine</h2>

    <div class="field">
      <label for="prompt">Prompt (user question)</label>
      <textarea
        id="prompt"
        rows="4"
        class="prompt-textarea"
        placeholder="Enter benchmark prompt (e.g. Explain quantum computing in detail...)"
        :value="prompt"
        :disabled="running"
        @input="updatePrompt($event)"
      />
      <p class="small muted">실제 LLM에 전송될 질문입니다. 긴 질문일수록 TTFT 및 TPS(초당 토큰 속도)를 명확하게 측정할 수 있습니다.</p>
    </div>

    <div class="field">
      <label for="endpoint">Endpoint URL <span class="hint">(OpenAI-compatible)</span></label>
      <input
        id="endpoint"
        type="text"
        placeholder="http://localhost:11434"
        :value="config.endpoint"
        :disabled="running"
        @input="text('endpoint')($event)"
      />
      <p class="small muted">Ollama · vLLM · llama.cpp · LM Studio · SGLang</p>
    </div>

    <div v-if="isMixedContent" class="mixed-content-banner">
      <div class="banner-title">⚠️ HTTPS(Vercel) 혼합 콘텐츠(Mixed Content) 안내</div>
      <p class="banner-desc">
        현재 웹사이트가 <strong>HTTPS(Vercel)</strong>로 구동 중이어서 브라우저 보안 정책상 비보안 로컬 주소(<code>http://localhost</code>) 호출이 차단되어 응답이 오지 않습니다.
      </p>
      <details class="banner-details">
        <summary>해결 방법 4가지</summary>
        <ol>
          <li><strong>로컬 개발 서버 실행 (가장 추천):</strong> 터미널에서 <code>npm run dev</code> 실행 후 <code>http://localhost:5173</code>(HTTP)으로 접속</li>
          <li><strong>Tauri 데스크톱 앱 실행:</strong> <code>npm run tauri dev</code>로 네이티브 앱 실행 (브라우저 제약 없음)</li>
          <li><strong>터널로 로컬에 HTTPS 주소 부여:</strong> <code>npx cloudflared tunnel --url http://localhost:11434</code> 실행 후 발급된 <code>https://...trycloudflare.com</code>을 Endpoint에 입력</li>
          <li><strong>Chrome 사이트 설정 허용:</strong> 주소창 좌측 사이트 설정 → '안전하지 않은 콘텐츠(Insecure content)'를 '허용'으로 변경 (로컬 Ollama 실행 시 <code>OLLAMA_ORIGINS="*"</code> 환경변수 필요)</li>
        </ol>
      </details>
    </div>

    <div class="field">
      <label for="api-key">API Key <span class="hint">(optional)</span></label>
      <input
        id="api-key"
        type="password"
        placeholder="sk-... or leave blank for local"
        :value="config.apiKey"
        :disabled="running"
        @input="text('apiKey')($event)"
      />
    </div>

    <div class="row">
      <div class="field">
        <label for="model">Model</label>
        <input
          id="model"
          type="text"
          placeholder="llama3.1"
          :value="config.model"
          :disabled="running"
          @input="text('model')($event)"
        />
      </div>
      <div class="field">
        <label for="temp">Temperature</label>
        <input
          id="temp"
          type="number"
          min="0"
          max="2"
          step="0.1"
          :value="config.temperature"
          :disabled="running"
          @input="num('temperature')($event)"
        />
      </div>
    </div>

    <div class="field">
      <label for="max-tokens">Max tokens</label>
      <input
        id="max-tokens"
        type="number"
        min="1"
        max="8192"
        :value="config.maxTokens"
        :disabled="running"
        @input="num('maxTokens')($event)"
      />
    </div>

    <div class="field">
      <label for="system">System prompt</label>
      <textarea
        id="system"
        placeholder="Optional system prompt to measure its effect on TTFT."
        :value="config.systemPrompt"
        :disabled="running"
        @input="text('systemPrompt')($event)"
      />
    </div>

    <button
      class="btn btn-primary"
      style="width: 100%"
      :disabled="running || !config.endpoint || !config.model"
      @click="running ? emit('abort') : emit('start')"
    >
      {{ running ? '⏸ Abort' : '▶ Run benchmark' }}
    </button>
    <p class="small muted" style="margin-top: 10px">
      Speed is measured entirely in the app; your API key never leaves this device.
    </p>
  </section>
</template>
