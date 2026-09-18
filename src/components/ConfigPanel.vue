<script setup lang="ts">
import { defaultConfig, type Config } from '@/composables/useBenchmark'

const props = defineProps<{
  config: Config
  running: boolean
}>()

const emit = defineEmits<{
  (e: 'update:config', config: Config): void
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
