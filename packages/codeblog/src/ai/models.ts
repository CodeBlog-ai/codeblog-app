export interface ModelInfo {
  id: string
  providerID: string
  name: string
  contextWindow: number
  outputTokens: number
}

export const BUILTIN_MODELS: Record<string, ModelInfo> = {
  "claude-sonnet-4-20250514": { id: "claude-sonnet-4-20250514", providerID: "anthropic", name: "Claude Sonnet 4", contextWindow: 200000, outputTokens: 16384 },
  "claude-3-5-haiku-20241022": { id: "claude-3-5-haiku-20241022", providerID: "anthropic", name: "Claude 3.5 Haiku", contextWindow: 200000, outputTokens: 8192 },
  "gpt-5.2": { id: "gpt-5.2", providerID: "openai", name: "GPT-5.2", contextWindow: 400000, outputTokens: 128000 },
  "gpt-4o": { id: "gpt-4o", providerID: "openai", name: "GPT-4o", contextWindow: 128000, outputTokens: 16384 },
  "gpt-4o-mini": { id: "gpt-4o-mini", providerID: "openai", name: "GPT-4o Mini", contextWindow: 128000, outputTokens: 16384 },
  "o3-mini": { id: "o3-mini", providerID: "openai", name: "o3-mini", contextWindow: 200000, outputTokens: 100000 },
  "gemini-2.5-flash": { id: "gemini-2.5-flash", providerID: "google", name: "Gemini 2.5 Flash", contextWindow: 1048576, outputTokens: 65536 },
  "gemini-2.5-pro": { id: "gemini-2.5-pro", providerID: "google", name: "Gemini 2.5 Pro", contextWindow: 1048576, outputTokens: 65536 },
}

export const DEFAULT_MODEL = "claude-sonnet-4-20250514"
const LEGACY_MODEL_MAP: Record<string, string> = {
  "4.0Ultra": "gpt-5.2",
  "4.0ultra": "gpt-5.2",
}

const PROVIDER_DEFAULT_MODEL: Record<string, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-5.2",
  google: "gemini-2.5-flash",
  "openai-compatible": "gpt-5.2",
}

export function normalizeModelID(modelID?: string): string | undefined {
  if (!modelID) return undefined
  const trimmed = modelID.trim()
  if (!trimmed) return undefined
  if (LEGACY_MODEL_MAP[trimmed]) return LEGACY_MODEL_MAP[trimmed]
  if (!trimmed.includes("/")) return trimmed
  const [providerID, ...rest] = trimmed.split("/")
  const raw = rest.join("/")
  if (!raw) return trimmed
  const mapped = LEGACY_MODEL_MAP[raw]
  if (!mapped) return trimmed
  return `${providerID}/${mapped}`
}

export function defaultModelForProvider(providerID?: string): string {
  if (!providerID) return DEFAULT_MODEL
  return PROVIDER_DEFAULT_MODEL[providerID] || DEFAULT_MODEL
}

export function resolveModelFromConfig(cfg: { model?: string; default_provider?: string }): string {
  const model = normalizeModelID(cfg.model)
  if (model) return model
  const fallback = defaultModelForProvider(cfg.default_provider)
  if (cfg.default_provider === "openai-compatible" && !fallback.includes("/")) {
    return `openai-compatible/${fallback}`
  }
  return fallback
}

export function inferProviderByModelPrefix(modelID: string): string | undefined {
  if (modelID.startsWith("claude-")) return "anthropic"
  if (modelID.startsWith("gpt-") || modelID.startsWith("o1-") || modelID.startsWith("o3-")) return "openai"
  if (modelID.startsWith("gemini-")) return "google"
  return undefined
}
