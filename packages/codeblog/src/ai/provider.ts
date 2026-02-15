import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { type LanguageModel, type Provider as SDK } from "ai"
import { Config } from "../config"
import { Log } from "../util/log"

const log = Log.create({ service: "ai-provider" })

export namespace AIProvider {
  // ---------------------------------------------------------------------------
  // Bundled providers (4 core)
  // ---------------------------------------------------------------------------
  const BUNDLED_PROVIDERS: Record<string, (options: any) => SDK> = {
    "@ai-sdk/anthropic": createAnthropic as any,
    "@ai-sdk/openai": createOpenAI as any,
    "@ai-sdk/google": createGoogleGenerativeAI as any,
    "@ai-sdk/openai-compatible": createOpenAICompatible as any,
  }

  // ---------------------------------------------------------------------------
  // Provider env key mapping
  // ---------------------------------------------------------------------------
  const PROVIDER_ENV: Record<string, string[]> = {
    anthropic: ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"],
    openai: ["OPENAI_API_KEY"],
    google: ["GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEY"],
    "openai-compatible": ["OPENAI_COMPATIBLE_API_KEY"],
  }

  // ---------------------------------------------------------------------------
  // Provider base URL env mapping
  // ---------------------------------------------------------------------------
  const PROVIDER_BASE_URL_ENV: Record<string, string[]> = {
    anthropic: ["ANTHROPIC_BASE_URL"],
    openai: ["OPENAI_BASE_URL", "OPENAI_API_BASE"],
    google: ["GOOGLE_API_BASE_URL"],
    "openai-compatible": ["OPENAI_COMPATIBLE_BASE_URL"],
  }

  // ---------------------------------------------------------------------------
  // Provider → npm package mapping
  // ---------------------------------------------------------------------------
  const PROVIDER_NPM: Record<string, string> = {
    anthropic: "@ai-sdk/anthropic",
    openai: "@ai-sdk/openai",
    google: "@ai-sdk/google",
    "openai-compatible": "@ai-sdk/openai-compatible",
  }

  // ---------------------------------------------------------------------------
  // Model info type
  // ---------------------------------------------------------------------------
  export interface ModelInfo {
    id: string
    providerID: string
    name: string
    contextWindow: number
    outputTokens: number
  }

  // ---------------------------------------------------------------------------
  // Built-in model list
  // ---------------------------------------------------------------------------
  export const BUILTIN_MODELS: Record<string, ModelInfo> = {
    "claude-sonnet-4-20250514": { id: "claude-sonnet-4-20250514", providerID: "anthropic", name: "Claude Sonnet 4", contextWindow: 200000, outputTokens: 16384 },
    "claude-3-5-haiku-20241022": { id: "claude-3-5-haiku-20241022", providerID: "anthropic", name: "Claude 3.5 Haiku", contextWindow: 200000, outputTokens: 8192 },
    "gpt-4o": { id: "gpt-4o", providerID: "openai", name: "GPT-4o", contextWindow: 128000, outputTokens: 16384 },
    "gpt-4o-mini": { id: "gpt-4o-mini", providerID: "openai", name: "GPT-4o Mini", contextWindow: 128000, outputTokens: 16384 },
    "o3-mini": { id: "o3-mini", providerID: "openai", name: "o3-mini", contextWindow: 200000, outputTokens: 100000 },
    "gemini-2.5-flash": { id: "gemini-2.5-flash", providerID: "google", name: "Gemini 2.5 Flash", contextWindow: 1048576, outputTokens: 65536 },
    "gemini-2.5-pro": { id: "gemini-2.5-pro", providerID: "google", name: "Gemini 2.5 Pro", contextWindow: 1048576, outputTokens: 65536 },
  }

  export const DEFAULT_MODEL = "claude-sonnet-4-20250514"

  // ---------------------------------------------------------------------------
  // Get API key for a provider
  // ---------------------------------------------------------------------------
  export async function getApiKey(providerID: string): Promise<string | undefined> {
    const envKeys = PROVIDER_ENV[providerID] || []
    for (const key of envKeys) {
      if (process.env[key]) return process.env[key]
    }
    const cfg = await Config.load()
    return cfg.providers?.[providerID]?.api_key
  }

  // ---------------------------------------------------------------------------
  // Get base URL for a provider
  // ---------------------------------------------------------------------------
  export async function getBaseUrl(providerID: string): Promise<string | undefined> {
    const envKeys = PROVIDER_BASE_URL_ENV[providerID] || []
    for (const key of envKeys) {
      if (process.env[key]) return process.env[key]
    }
    const cfg = await Config.load()
    return cfg.providers?.[providerID]?.base_url
  }

  // ---------------------------------------------------------------------------
  // List all available providers
  // ---------------------------------------------------------------------------
  export async function listProviders(): Promise<Record<string, { name: string; models: string[]; hasKey: boolean }>> {
    const result: Record<string, { name: string; models: string[]; hasKey: boolean }> = {}
    for (const model of Object.values(BUILTIN_MODELS)) {
      if (!result[model.providerID]) {
        const key = await getApiKey(model.providerID)
        result[model.providerID] = { name: model.providerID, models: [], hasKey: !!key }
      }
      if (!result[model.providerID]!.models.includes(model.id)) {
        result[model.providerID]!.models.push(model.id)
      }
    }
    const compatKey = await getApiKey("openai-compatible")
    if (compatKey) {
      result["openai-compatible"] = { name: "OpenAI Compatible", models: [], hasKey: true }
    }
    return result
  }

  // ---------------------------------------------------------------------------
  // Get a LanguageModel instance
  // ---------------------------------------------------------------------------
  const sdkCache = new Map<string, SDK>()

  export async function getModel(modelID?: string): Promise<LanguageModel> {
    const id = modelID || (await getConfiguredModel()) || DEFAULT_MODEL

    const builtin = BUILTIN_MODELS[id]
    if (builtin) {
      const apiKey = await getApiKey(builtin.providerID)
      if (!apiKey) throw noKeyError(builtin.providerID)
      const base = await getBaseUrl(builtin.providerID)
      return getLanguageModel(builtin.providerID, id, apiKey, undefined, base)
    }

    if (id.includes("/")) {
      const [providerID, ...rest] = id.split("/")
      const mid = rest.join("/")
      const apiKey = await getApiKey(providerID!)
      if (!apiKey) throw noKeyError(providerID!)
      const base = await getBaseUrl(providerID!)
      return getLanguageModel(providerID!, mid, apiKey, undefined, base)
    }

    const cfg = await Config.load()
    if (cfg.providers) {
      for (const [providerID, p] of Object.entries(cfg.providers)) {
        if (!p.api_key) continue
        const base = p.base_url || (await getBaseUrl(providerID))
        if (base) {
          log.info("fallback: sending unknown model to provider with base_url", { provider: providerID, model: id })
          return getLanguageModel(providerID, id, p.api_key, undefined, base)
        }
      }
    }

    throw new Error(`Unknown model: ${id}. Run: codeblog config --list`)
  }

  function getLanguageModel(providerID: string, modelID: string, apiKey: string, npm?: string, baseURL?: string): LanguageModel {
    const pkg = npm || PROVIDER_NPM[providerID] || "@ai-sdk/openai-compatible"
    const cacheKey = `${providerID}:${pkg}:${apiKey.slice(0, 8)}`

    log.info("loading model", { provider: providerID, model: modelID, pkg })

    let sdk = sdkCache.get(cacheKey)
    if (!sdk) {
      const createFn = BUNDLED_PROVIDERS[pkg]
      if (!createFn) throw new Error(`No bundled provider for ${pkg}. Use openai-compatible with a base URL instead.`)
      const opts: Record<string, unknown> = { apiKey, name: providerID }
      if (baseURL) {
        const clean = baseURL.replace(/\/+$/, "")
        opts.baseURL = clean.endsWith("/v1") ? clean : `${clean}/v1`
      }
      sdk = createFn(opts)
      sdkCache.set(cacheKey, sdk)
    }

    if (pkg === "@ai-sdk/openai-compatible" && typeof (sdk as any).chatModel === "function") {
      return (sdk as any).chatModel(modelID)
    }
    if (typeof (sdk as any).languageModel === "function") {
      return (sdk as any).languageModel(modelID)
    }
    return (sdk as any)(modelID)
  }

  function noKeyError(providerID: string): Error {
    const envKeys = PROVIDER_ENV[providerID] || []
    const envHint = envKeys[0] || `${providerID.toUpperCase().replace(/-/g, "_")}_API_KEY`
    return new Error(`No API key for ${providerID}. Set ${envHint} or run: codeblog config --provider ${providerID} --api-key <key>`)
  }

  async function getConfiguredModel(): Promise<string | undefined> {
    const cfg = await Config.load()
    return cfg.model
  }

  // ---------------------------------------------------------------------------
  // Check if any AI provider has a key configured
  // ---------------------------------------------------------------------------
  export async function hasAnyKey(): Promise<boolean> {
    for (const providerID of Object.keys(PROVIDER_ENV)) {
      const key = await getApiKey(providerID)
      if (key) return true
    }
    const cfg = await Config.load()
    if (cfg.providers) {
      for (const p of Object.values(cfg.providers)) {
        if (p.api_key) return true
      }
    }
    return false
  }

  // ---------------------------------------------------------------------------
  // List available models with key status
  // ---------------------------------------------------------------------------
  export async function available(): Promise<Array<{ model: ModelInfo; hasKey: boolean }>> {
    const result: Array<{ model: ModelInfo; hasKey: boolean }> = []
    for (const model of Object.values(BUILTIN_MODELS)) {
      const apiKey = await getApiKey(model.providerID)
      result.push({ model, hasKey: !!apiKey })
    }
    return result
  }

  // ---------------------------------------------------------------------------
  // Parse provider/model format
  // ---------------------------------------------------------------------------
  export function parseModel(model: string) {
    const [providerID, ...rest] = model.split("/")
    return { providerID, modelID: rest.join("/") }
  }
}
