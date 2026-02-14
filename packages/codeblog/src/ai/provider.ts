import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock"
import { createAzure } from "@ai-sdk/azure"
import { createVertex } from "@ai-sdk/google-vertex"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { createXai } from "@ai-sdk/xai"
import { createMistral } from "@ai-sdk/mistral"
import { createGroq } from "@ai-sdk/groq"
import { createDeepInfra } from "@ai-sdk/deepinfra"
import { createCerebras } from "@ai-sdk/cerebras"
import { createCohere } from "@ai-sdk/cohere"
import { createGateway } from "@ai-sdk/gateway"
import { createTogetherAI } from "@ai-sdk/togetherai"
import { createPerplexity } from "@ai-sdk/perplexity"
import { createVercel } from "@ai-sdk/vercel"
import { type LanguageModel, type Provider as SDK } from "ai"
import { Config } from "../config"
import { Log } from "../util/log"
import { Global } from "../global"
import path from "path"

const log = Log.create({ service: "ai-provider" })

export namespace AIProvider {
  // ---------------------------------------------------------------------------
  // Bundled providers — same mapping as opencode
  // ---------------------------------------------------------------------------
  const BUNDLED_PROVIDERS: Record<string, (options: any) => SDK> = {
    "@ai-sdk/amazon-bedrock": createAmazonBedrock,
    "@ai-sdk/anthropic": createAnthropic,
    "@ai-sdk/azure": createAzure,
    "@ai-sdk/google": createGoogleGenerativeAI,
    "@ai-sdk/google-vertex": createVertex as any,
    "@ai-sdk/openai": createOpenAI,
    "@ai-sdk/openai-compatible": createOpenAICompatible,
    "@openrouter/ai-sdk-provider": createOpenRouter as any,
    "@ai-sdk/xai": createXai,
    "@ai-sdk/mistral": createMistral,
    "@ai-sdk/groq": createGroq,
    "@ai-sdk/deepinfra": createDeepInfra,
    "@ai-sdk/cerebras": createCerebras,
    "@ai-sdk/cohere": createCohere,
    "@ai-sdk/gateway": createGateway,
    "@ai-sdk/togetherai": createTogetherAI,
    "@ai-sdk/perplexity": createPerplexity,
    "@ai-sdk/vercel": createVercel,
  }

  // ---------------------------------------------------------------------------
  // Provider env key mapping
  // ---------------------------------------------------------------------------
  const PROVIDER_ENV: Record<string, string[]> = {
    anthropic: ["ANTHROPIC_API_KEY"],
    openai: ["OPENAI_API_KEY"],
    google: ["GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEY"],
    "amazon-bedrock": ["AWS_ACCESS_KEY_ID"],
    azure: ["AZURE_API_KEY", "AZURE_OPENAI_API_KEY"],
    xai: ["XAI_API_KEY"],
    mistral: ["MISTRAL_API_KEY"],
    groq: ["GROQ_API_KEY"],
    deepinfra: ["DEEPINFRA_API_KEY"],
    cerebras: ["CEREBRAS_API_KEY"],
    cohere: ["COHERE_API_KEY"],
    togetherai: ["TOGETHER_AI_API_KEY", "TOGETHERAI_API_KEY"],
    perplexity: ["PERPLEXITY_API_KEY"],
    openrouter: ["OPENROUTER_API_KEY"],
    "openai-compatible": ["OPENAI_COMPATIBLE_API_KEY"],
  }

  // ---------------------------------------------------------------------------
  // Provider → npm package mapping
  // ---------------------------------------------------------------------------
  const PROVIDER_NPM: Record<string, string> = {
    anthropic: "@ai-sdk/anthropic",
    openai: "@ai-sdk/openai",
    google: "@ai-sdk/google",
    "amazon-bedrock": "@ai-sdk/amazon-bedrock",
    azure: "@ai-sdk/azure",
    "google-vertex": "@ai-sdk/google-vertex",
    xai: "@ai-sdk/xai",
    mistral: "@ai-sdk/mistral",
    groq: "@ai-sdk/groq",
    deepinfra: "@ai-sdk/deepinfra",
    cerebras: "@ai-sdk/cerebras",
    cohere: "@ai-sdk/cohere",
    gateway: "@ai-sdk/gateway",
    togetherai: "@ai-sdk/togetherai",
    perplexity: "@ai-sdk/perplexity",
    vercel: "@ai-sdk/vercel",
    openrouter: "@openrouter/ai-sdk-provider",
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
    npm?: string
  }

  // ---------------------------------------------------------------------------
  // Built-in model list (fallback when models.dev is unavailable)
  // ---------------------------------------------------------------------------
  export const BUILTIN_MODELS: Record<string, ModelInfo> = {
    "claude-sonnet-4-20250514": { id: "claude-sonnet-4-20250514", providerID: "anthropic", name: "Claude Sonnet 4", contextWindow: 200000, outputTokens: 16384 },
    "claude-3-5-haiku-20241022": { id: "claude-3-5-haiku-20241022", providerID: "anthropic", name: "Claude 3.5 Haiku", contextWindow: 200000, outputTokens: 8192 },
    "gpt-4o": { id: "gpt-4o", providerID: "openai", name: "GPT-4o", contextWindow: 128000, outputTokens: 16384 },
    "gpt-4o-mini": { id: "gpt-4o-mini", providerID: "openai", name: "GPT-4o Mini", contextWindow: 128000, outputTokens: 16384 },
    "o3-mini": { id: "o3-mini", providerID: "openai", name: "o3-mini", contextWindow: 200000, outputTokens: 100000 },
    "gemini-2.5-flash": { id: "gemini-2.5-flash", providerID: "google", name: "Gemini 2.5 Flash", contextWindow: 1048576, outputTokens: 65536 },
    "gemini-2.5-pro": { id: "gemini-2.5-pro", providerID: "google", name: "Gemini 2.5 Pro", contextWindow: 1048576, outputTokens: 65536 },
    "grok-3": { id: "grok-3", providerID: "xai", name: "Grok 3", contextWindow: 131072, outputTokens: 16384 },
    "grok-3-mini": { id: "grok-3-mini", providerID: "xai", name: "Grok 3 Mini", contextWindow: 131072, outputTokens: 16384 },
    "mistral-large-latest": { id: "mistral-large-latest", providerID: "mistral", name: "Mistral Large", contextWindow: 128000, outputTokens: 8192 },
    "codestral-latest": { id: "codestral-latest", providerID: "mistral", name: "Codestral", contextWindow: 256000, outputTokens: 8192 },
    "llama-3.3-70b-versatile": { id: "llama-3.3-70b-versatile", providerID: "groq", name: "Llama 3.3 70B (Groq)", contextWindow: 128000, outputTokens: 32768 },
    "deepseek-chat": { id: "deepseek-chat", providerID: "deepinfra", name: "DeepSeek V3", contextWindow: 64000, outputTokens: 8192 },
    "command-a-03-2025": { id: "command-a-03-2025", providerID: "cohere", name: "Command A", contextWindow: 256000, outputTokens: 16384 },
    "sonar-pro": { id: "sonar-pro", providerID: "perplexity", name: "Sonar Pro", contextWindow: 200000, outputTokens: 8192 },
  }

  export const DEFAULT_MODEL = "claude-sonnet-4-20250514"

  // ---------------------------------------------------------------------------
  // models.dev dynamic loading (same as opencode)
  // ---------------------------------------------------------------------------
  let modelsDevCache: Record<string, any> | null = null

  async function fetchModelsDev(): Promise<Record<string, any>> {
    if (modelsDevCache) return modelsDevCache
    const cachePath = path.join(Global.Path.cache, "models.json")
    const file = Bun.file(cachePath)
    const cached = await file.json().catch(() => null)
    if (cached) {
      modelsDevCache = cached
      return cached
    }
    try {
      const resp = await fetch("https://models.dev/api.json", { signal: AbortSignal.timeout(5000) })
      if (resp.ok) {
        const data = await resp.json()
        modelsDevCache = data as Record<string, any>
        await Bun.write(file, JSON.stringify(data)).catch(() => {})
        return modelsDevCache!
      }
    } catch {
      log.info("models.dev fetch failed, using builtin models")
    }
    return {}
  }

  // Refresh models.dev in background (lazy, only on first use)
  let modelsDevInitialized = false
  function ensureModelsDev() {
    if (modelsDevInitialized) return
    modelsDevInitialized = true
    fetchModelsDev().catch(() => {})
  }

  // ---------------------------------------------------------------------------
  // Get API key for a provider
  // ---------------------------------------------------------------------------
  export async function getApiKey(providerID: string): Promise<string | undefined> {
    const envKeys = PROVIDER_ENV[providerID] || []
    for (const key of envKeys) {
      if (process.env[key]) return process.env[key]
    }
    const cfg = await Config.load() as Record<string, unknown>
    const providers = (cfg.providers || {}) as Record<string, { api_key?: string }>
    return providers[providerID]?.api_key
  }

  // ---------------------------------------------------------------------------
  // List all available providers with their models
  // ---------------------------------------------------------------------------
  export async function listProviders(): Promise<Record<string, { name: string; models: string[]; hasKey: boolean }>> {
    const result: Record<string, { name: string; models: string[]; hasKey: boolean }> = {}
    const modelsDev = await fetchModelsDev()

    // From models.dev
    for (const [providerID, provider] of Object.entries(modelsDev)) {
      const p = provider as any
      if (!p.models || typeof p.models !== "object") continue
      const key = await getApiKey(providerID)
      result[providerID] = {
        name: p.name || providerID,
        models: Object.keys(p.models),
        hasKey: !!key,
      }
    }

    // Ensure builtin providers are always listed
    for (const model of Object.values(BUILTIN_MODELS)) {
      if (!result[model.providerID]) {
        const key = await getApiKey(model.providerID)
        result[model.providerID] = { name: model.providerID, models: [], hasKey: !!key }
      }
      if (!result[model.providerID].models.includes(model.id)) {
        result[model.providerID].models.push(model.id)
      }
    }

    return result
  }

  // ---------------------------------------------------------------------------
  // Get a LanguageModel instance
  // ---------------------------------------------------------------------------
  const sdkCache = new Map<string, SDK>()

  export async function getModel(modelID?: string): Promise<LanguageModel> {
    const id = modelID || (await getConfiguredModel()) || DEFAULT_MODEL

    // Try builtin first
    const builtin = BUILTIN_MODELS[id]
    if (builtin) {
      const apiKey = await getApiKey(builtin.providerID)
      if (!apiKey) throw noKeyError(builtin.providerID)
      return getLanguageModel(builtin.providerID, id, apiKey)
    }

    // Try models.dev
    const modelsDev = await fetchModelsDev()
    for (const [providerID, provider] of Object.entries(modelsDev)) {
      const p = provider as any
      if (p.models?.[id]) {
        const apiKey = await getApiKey(providerID)
        if (!apiKey) throw noKeyError(providerID)
        const npm = p.models[id].provider?.npm || p.npm || "@ai-sdk/openai-compatible"
        return getLanguageModel(providerID, id, apiKey, npm, p.api)
      }
    }

    // Try provider/model format
    if (id.includes("/")) {
      const [providerID, ...rest] = id.split("/")
      const mid = rest.join("/")
      const apiKey = await getApiKey(providerID)
      if (!apiKey) throw noKeyError(providerID)
      return getLanguageModel(providerID, mid, apiKey)
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
      if (!createFn) throw new Error(`No bundled provider for ${pkg}. Provider ${providerID} not supported.`)
      const opts: Record<string, unknown> = { apiKey }
      if (baseURL) opts.baseURL = baseURL
      if (providerID === "openrouter") {
        opts.headers = { "HTTP-Referer": "https://codeblog.ai/", "X-Title": "codeblog" }
      }
      if (providerID === "cerebras") {
        opts.headers = { "X-Cerebras-3rd-Party-Integration": "codeblog" }
      }
      sdk = createFn(opts)
      sdkCache.set(cacheKey, sdk)
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
    const cfg = await Config.load() as Record<string, unknown>
    return cfg.model as string | undefined
  }

  // ---------------------------------------------------------------------------
  // List available models with key status (for codeblog config --list)
  // ---------------------------------------------------------------------------
  export async function available(): Promise<Array<{ model: ModelInfo; hasKey: boolean }>> {
    const result: Array<{ model: ModelInfo; hasKey: boolean }> = []
    for (const model of Object.values(BUILTIN_MODELS)) {
      const key = await getApiKey(model.providerID)
      result.push({ model, hasKey: !!key })
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
