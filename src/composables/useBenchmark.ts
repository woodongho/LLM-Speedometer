import { reactive, ref } from 'vue'
import { streamEvents, HttpError, NetworkError } from '@/lib/llm'
import { computeMetrics } from '@/lib/metrics'
import { normalizeEndpoint } from '@/lib/endpoint'
import type { BenchmarkResult, Message, TokenEvent } from '@/lib/types'

export interface Config {
  endpoint: string
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
  systemPrompt: string
}

export const defaultConfig: Config = {
  endpoint: 'http://localhost:11434/v1/chat/completions',
  apiKey: '',
  model: 'llama3.1',
  temperature: 0.7,
  maxTokens: 256,
  systemPrompt: '',
}

export interface BenchmarkState {
  status: 'idle' | 'running' | 'done' | 'error'
  text: string
  tokens: TokenEvent[]
  result: BenchmarkResult | null
  error: string | null
  aborted: boolean
}

export function useBenchmark() {
  const status = ref<BenchmarkState['status']>('idle')
  const text = ref('')
  const tokens = ref<TokenEvent[]>([])
  const result = ref<BenchmarkResult | null>(null)
  const error = ref<string | null>(null)
  const aborted = ref(false)

  let controller: AbortController | null = null

  function reset() {
    status.value = 'idle'
    text.value = ''
    tokens.value = []
    result.value = null
    error.value = null
    aborted.value = false
  }

  async function run(config: Config, messages: Message[], prompt: string) {
    reset()
    status.value = 'running'

    const fullEndpoint = normalizeEndpoint(config.endpoint)
    controller = new AbortController()

    try {
      const handle = await streamEvents(
        {
          endpoint: fullEndpoint,
          apiKey: config.apiKey,
          model: config.model,
          messages,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          systemPrompt: prompt,
          onToken: (chunk) => {
            text.value += chunk
          },
        },
        { signal: controller.signal },
      )

      const r = computeMetrics({
        tokens: handle.tokens,
        usage: lastUsage(handle.events),
        ollama: lastOllama(handle.events),
      })
      result.value = r
      text.value = handle.text
      tokens.value = handle.tokens
      status.value = r.errors.length ? 'error' : 'done'
      if (r.errors.length) error.value = r.errors.join(' ')
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        status.value = 'done'
        aborted.value = true
      } else if (err instanceof HttpError) {
        error.value = `${err.status} ${err.statusText}${err.body ? ` — ${err.body.slice(0, 120)}` : ''}`
      } else if (err instanceof NetworkError) {
        error.value = err.message
      } else {
        error.value = err instanceof Error ? err.message : String(err)
      }
      status.value = 'error'
    } finally {
      controller = null
    }
  }

  function abort() {
    controller?.abort()
  }

  return { status, text, tokens, result, error, aborted, run, abort, reset }
}


function lastUsage(events: { usage?: any }[]): any {
  let last: any = undefined
  for (const e of events) {
    if (e.usage) last = e.usage
  }
  return last
}

function lastOllama(events: { ollama?: any }[]): any {
  let last: any = undefined
  for (const e of events) {
    if (e.ollama) last = e.ollama
  }
  return last
}
