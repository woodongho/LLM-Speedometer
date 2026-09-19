import type {
  BenchmarkResult,
  EngineType,
  OllamaMeta,
  TokenCountSource,
  TokenEvent,
  UsageInfo,
} from './types';

/** Round to a fixed number of decimals for stable, comparable output. */
export function round(value: number | null | undefined, decimals = 2): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function clampNonNegative(value: number | undefined, fallback = 0): number {
  return typeof value === 'number' && value >= 0 ? value : fallback;
}

const BPE_TOKEN_REGEX = /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;

export function estimateTokensFromText(text: string): number {
  if (!text || !text.trim()) return 0;
  const matches = text.trim().match(BPE_TOKEN_REGEX);
  return matches ? matches.length : Math.ceil(text.length / 4);
}

/**
 * Compute all speed metrics from a list of token events.
 *
 * Token counts are resolved in priority order: explicit OpenAI `usage`, then
 * Ollama `usage`, then a best-effort estimate by counting emitted tokens.
 */
export function computeMetrics(params: {
  tokens: TokenEvent[];
  usage?: UsageInfo;
  ollama?: OllamaMeta;
  engine?: EngineType;
  promptText?: string;
}): BenchmarkResult {
  const { tokens = [], usage, ollama, engine = 'unknown', promptText } = params;
  const errors: string[] = [];

  let resolvedEngine = engine;
  if (
    ollama &&
    (ollama.eval_count !== undefined || ollama.prompt_eval_count !== undefined)
  ) {
    resolvedEngine = 'ollama';
  }

  // --- Token counting (priority: usage > ollama > estimate) ---
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let tokenCountSource: TokenCountSource = 'none';

  if (usage && (usage.prompt_tokens !== undefined || usage.completion_tokens !== undefined)) {
    tokenCountSource = 'usage';
    promptTokens = clampNonNegative(usage.prompt_tokens);
    completionTokens = clampNonNegative(usage.completion_tokens);
    totalTokens =
      usage.total_tokens !== undefined
        ? clampNonNegative(usage.total_tokens)
        : promptTokens + completionTokens;
  } else if (ollama && (ollama.prompt_eval_count !== undefined || ollama.eval_count !== undefined)) {
    tokenCountSource = 'usage';
    promptTokens = clampNonNegative(ollama.prompt_eval_count);
    completionTokens = clampNonNegative(ollama.eval_count);
    totalTokens = promptTokens + completionTokens;
  } else if (tokens.length > 0) {
    tokenCountSource = 'estimated';
    // Count tokens that actually carried text; fall back to raw token count.
    const contentTokens = tokens.filter((t) => t.content.length > 0).length;
    completionTokens = contentTokens > 0 ? contentTokens : tokens.length;
    promptTokens = promptText ? estimateTokensFromText(promptText) : 0;
    totalTokens = promptTokens + completionTokens;
    if (contentTokens === 0) {
      errors.push('No token content was emitted; token count is an estimate.');
    }
  } else {
    tokenCountSource = 'none';
  }

  if (tokens.length === 0) {
    errors.push('No tokens were received from the model.');
  }

  // --- Timing metrics ---
  let ttftMs: number | null = null;
  let generationDurationMs: number | null = null;
  let totalDurationMs: number | null = null;
  let tpotMs: number | null = null;
  let tps: number | null = null;
  let effectiveTps: number | null = null;

  if (tokens.length > 0) {
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    ttftMs = first.ts;

    // A token with zero-length content still marks an elapsed step; include it.
    const ordered = [...tokens].sort((a, b) => a.ts - b.ts);
    const tFirst = ordered[0].ts;
    const tLast = ordered[ordered.length - 1].ts;
    totalDurationMs = tLast;

    if (tokens.length >= 2) {
      generationDurationMs = tLast - tFirst;
      const intervals = tokens.length - 1;
      tpotMs = generationDurationMs / intervals;
      if (generationDurationMs > 0) {
        tps = (completionTokens / generationDurationMs) * 1000;
      } else {
        errors.push('All tokens arrived within the same millisecond; TPS is undefined.');
      }
    } else {
      generationDurationMs = 0;
      errors.push('Only a single token was generated; TPOT and generation TPS are unavailable.');
    }

    if (tLast > 0 && completionTokens > 0) {
      effectiveTps = (completionTokens / tLast) * 1000;
    }
  }

  // --- Ollama-derived metrics ---
  let promptEvalMs: number | null = null;
  let promptTps: number | null = null;
  let ollamaTps: number | null = null;

  if (ollama) {
    if (typeof ollama.prompt_eval_duration === 'number' && ollama.prompt_eval_duration > 0) {
      promptEvalMs = ollama.prompt_eval_duration / 1e6;
      if (promptTokens > 0) {
        promptTps = (promptTokens / (ollama.prompt_eval_duration / 1e9));
      }
    }
    if (typeof ollama.eval_duration === 'number' && ollama.eval_duration > 0 && ollama.eval_count) {
      ollamaTps = ollama.eval_count / (ollama.eval_duration / 1e9);
    }
  }

  return {
    engine: resolvedEngine,
    ttftMs: round(ttftMs),
    tpotMs: round(tpotMs),
    tps: round(tps),
    effectiveTps: round(effectiveTps),
    generationDurationMs: round(generationDurationMs),
    totalDurationMs: round(totalDurationMs),
    promptTokens,
    completionTokens,
    totalTokens,
    tokenCountSource,
    promptEvalMs: round(promptEvalMs, 1),
    promptTps: round(promptTps),
    ollamaTps: round(ollamaTps),
    rawText: tokens.map((t) => t.content).join(''),
    ollama,
    errors,
  };
}
