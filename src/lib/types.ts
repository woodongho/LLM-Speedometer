export type EngineType = 'openai' | 'ollama' | 'unknown';

export interface Message {
  role: string;
  content: string;
}

/** One generated token event with an elapsed timestamp (ms since request start). */
export interface TokenEvent {
  /** 0-based index of this token within the generated sequence. */
  index: number;
  /** Delta text for this token (may be empty string). */
  content: string;
  /** Wall-clock elapsed time in ms measured from the moment the request was issued. */
  ts: number;
}

export interface UsageInfo {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

/** Ollama-specific usage metadata (nanosecond durations). */
export interface OllamaMeta {
  prompt_eval_count?: number;
  eval_count?: number;
  /** Total nanoseconds spent decoding (generating) tokens. */
  eval_duration?: number;
  /** Total nanoseconds spent evaluating (prefilling) the prompt. */
  prompt_eval_duration?: number;
}

export type TokenCountSource = 'usage' | 'estimated' | 'none';

export interface BenchmarkResult {
  engine: EngineType;

  /** Time to First Token in ms. */
  ttftMs: number | null;
  /** Average Time Per Output Token in ms. */
  tpotMs: number | null;
  /** Generation throughput: completion tokens per second over the decode phase. */
  tps: number | null;
  /** Effective throughput over the full wall-clock time (includes TTFT / prefill). */
  effectiveTps: number | null;
  /** Decode-phase duration (last token ts - first token ts) in ms. */
  generationDurationMs: number | null;
  /** Full wall-clock duration from request start to last token in ms. */
  totalDurationMs: number | null;

  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  tokenCountSource: TokenCountSource;

  /** Nanosecond prompt-processing time from Ollama metadata, if present. */
  promptEvalMs: number | null;
  /** Prompt evaluation throughput (tokens/sec) from Ollama metadata. */
  promptTps: number | null;
  /** Generation throughput reported directly by Ollama eval_duration. */
  ollamaTps: number | null;

  rawText: string;
  ollama?: OllamaMeta;
  errors: string[];
}

export interface StoredRun extends BenchmarkResult {
  id: string;
  createdAt: string;
  label: string;
  endpoint: string;
  model: string;
}
