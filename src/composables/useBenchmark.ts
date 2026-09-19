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

export const DEFAULT_PROMPT =
  'Explain the architectural evolution of large language models from the original Transformer to modern decoder-only architectures. Discuss key innovations such as multi-head self-attention, rotary position embeddings (RoPE), SwiGLU activation functions, and post-training alignment techniques (RLHF/DPO) in detail.'

export const defaultConfig: Config = {
  endpoint: 'http://localhost:11434/v1/chat/completions',
  apiKey: '',
  model: 'llama3.1',
  temperature: 0.7,
  maxTokens: 1024,
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
  const currentTps = ref(0)
  const peakTps = ref(0)

  let controller: AbortController | null = null

  function reset() {
    status.value = 'idle'
    text.value = ''
    tokens.value = []
    result.value = null
    error.value = null
    aborted.value = false
    currentTps.value = 0
  }

  async function run(
    config: Config,
    messages: Message[],
    prompt: string,
    options?: { onToken?: (chunk: string, liveTps: number) => void },
  ) {
    reset()
    status.value = 'running'

    const fullEndpoint = normalizeEndpoint(config.endpoint)
    controller = new AbortController()

    const startTime = performance.now()
    const liveTimestamps: number[] = []

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
            const nowMs = performance.now()
            liveTimestamps.push(nowMs)

            // Sliding window (last 1000ms) for real-time tachometer needle
            const threshold = nowMs - 1000
            while (liveTimestamps.length > 0 && liveTimestamps[0] < threshold) {
              liveTimestamps.shift()
            }
            const elapsedSinceStart = nowMs - startTime
            const span = Math.min(elapsedSinceStart, 1000)
            if (span > 80) {
              const liveRate = Math.round((liveTimestamps.length * 1000) / span)
              currentTps.value = liveRate
              if (liveRate > peakTps.value) {
                peakTps.value = liveRate
              }
            }
            options?.onToken?.(chunk, currentTps.value)
          },
        },
        { signal: controller.signal },
      )

      const promptCombined = [prompt, ...messages.map((m) => m.content)].filter(Boolean).join('\n')
      const r = computeMetrics({
        tokens: handle.tokens,
        usage: lastUsage(handle.events),
        ollama: lastOllama(handle.events),
        promptText: promptCombined,
      })
      result.value = r
      text.value = handle.text
      tokens.value = handle.tokens
      if (r.tps != null && r.tps > 0) {
        currentTps.value = r.tps
        if (r.tps > peakTps.value) {
          peakTps.value = r.tps
        }
      }
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
        const rawMsg = err instanceof Error ? err.message : String(err)
        if (
          (rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError') || rawMsg.includes('Load failed')) &&
          typeof window !== 'undefined' &&
          window.location.protocol === 'https:' &&
          fullEndpoint.startsWith('http:')
        ) {
          error.value = `[Mixed Content 차단] HTTPS(Vercel) 사이트에서는 브라우저 보안 정책으로 인해 HTTP 로컬 주소(${fullEndpoint})로의 요청이 차단됩니다. 터널(Cloudflare/ngrok)을 사용하거나 로컬/데스크톱 앱으로 구동해주세요.`
        } else if (rawMsg.includes('Failed to fetch')) {
          error.value = `연결 실패 (Failed to fetch): 엔드포인트 URL이 올바른지, 서버가 실행 중인지, CORS(OLLAMA_ORIGINS)가 허용되었는지 확인하세요.`
        } else {
          error.value = rawMsg
        }
      }
      status.value = 'error'
    } finally {
      controller = null
    }
  }

  function abort() {
    controller?.abort()
  }

  return { status, text, tokens, result, error, aborted, currentTps, peakTps, run, abort, reset }
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
