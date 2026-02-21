import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { type LanguageModel, type Provider as SDK } from "ai"
import { Config } from "../config"
import { Log } from "../util/log"
import { BUILTIN_MODELS as CORE_MODELS, DEFAULT_MODEL as CORE_DEFAULT_MODEL, type ModelInfo as CoreModelInfo, resolveModelFromConfig, normalizeModelID } from "./models"
import { loadProviders, PROVIDER_BASE_URL_ENV, PROVIDER_ENV, routeModel } from "./provider-registry"
import { patchRequestByCompat, resolveCompat, type ModelApi, type ModelCompatConfig } from "./types"

const log = Log.create({ service: "ai-provider" })

export namespace AIProvider {
  const BUNDLED_PROVIDERS: Record<string, (options: any) => SDK> = {
    "@ai-sdk/anthropic": createAnthropic as any,
    "@ai-sdk/openai": createOpenAI as any,
    "@ai-sdk/google": createGoogleGenerativeAI as any,
    "@ai-sdk/openai-compatible": createOpenAICompatible as any,
  }

  const PROVIDER_NPM: Record<ModelApi, string> = {
    anthropic: "@ai-sdk/anthropic",
    openai: "@ai-sdk/openai",
    google: "@ai-sdk/google",
    "openai-compatible": "@ai-sdk/openai-compatible",
  }

  export const BUILTIN_MODELS = CORE_MODELS
  export const DEFAULT_MODEL = CORE_DEFAULT_MODEL
  export type ModelInfo = CoreModelInfo

  export async function getApiKey(providerID: string): Promise<string | undefined> {
    const envKeys = PROVIDER_ENV[providerID] || []
    for (const key of envKeys) {
      if (process.env[key]) return process.env[key]
    }
    const cfg = await Config.load()
    return cfg.providers?.[providerID]?.api_key
  }

  export async function getBaseUrl(providerID: string): Promise<string | undefined> {
    const envKeys = PROVIDER_BASE_URL_ENV[providerID] || []
    for (const key of envKeys) {
      if (process.env[key]) return process.env[key]
    }
    const cfg = await Config.load()
    return cfg.providers?.[providerID]?.base_url
  }

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
    const compatBase = await getBaseUrl("openai-compatible")
    if (compatKey && compatBase) {
      const remoteModels = await fetchRemoteModels(compatBase, compatKey)
      result["openai-compatible"] = { name: "OpenAI Compatible", models: remoteModels, hasKey: true }
    }

    const loaded = await loadProviders()
    for (const provider of Object.values(loaded.providers)) {
      if (result[provider.id]) continue
      if (!provider.apiKey) continue
      result[provider.id] = { name: provider.id, models: [], hasKey: true }
    }

    return result
  }

  const sdkCache = new Map<string, SDK>()

  async function loadCodeblogFetch(): Promise<typeof globalThis.fetch> {
    const { getCodeblogFetch } = await import("./codeblog-provider")
    return getCodeblogFetch()
  }

  export async function getModel(modelID?: string): Promise<LanguageModel> {
    const useRegistry = await Config.featureEnabled("ai_provider_registry_v2")
    if (useRegistry) {
      const route = await routeModel(modelID)
      const customFetch = route.providerID === "codeblog" ? await loadCodeblogFetch() : undefined
      return getLanguageModel(route.providerID, route.modelID, route.apiKey, undefined, route.baseURL, route.compat, customFetch)
    }
    return getModelLegacy(modelID)
  }

  export async function resolveModelCompat(modelID?: string): Promise<ModelCompatConfig> {
    const useRegistry = await Config.featureEnabled("ai_provider_registry_v2")
    if (useRegistry) return (await routeModel(modelID)).compat
    return (await resolveLegacyRoute(modelID)).compat
  }

  async function getModelLegacy(modelID?: string): Promise<LanguageModel> {
    const route = await resolveLegacyRoute(modelID)
    const customFetch = route.providerID === "codeblog" ? await loadCodeblogFetch() : undefined
    return getLanguageModel(route.providerID, route.modelID, route.apiKey, undefined, route.baseURL, route.compat, customFetch)
  }

  async function resolveLegacyRoute(modelID?: string): Promise<{
    providerID: string
    modelID: string
    apiKey: string
    baseURL?: string
    compat: ModelCompatConfig
  }> {
    const requested = normalizeModelID(modelID) || (await getConfiguredModel()) || DEFAULT_MODEL
    const cfg = await Config.load()

    const builtin = BUILTIN_MODELS[requested]
    if (builtin) {
      const apiKey = await getApiKey(builtin.providerID)
      if (!apiKey) throw noKeyError(builtin.providerID)
      const baseURL = await getBaseUrl(builtin.providerID)
      return {
        providerID: builtin.providerID,
        modelID: requested,
        apiKey,
        baseURL,
        compat: resolveCompat({ providerID: builtin.providerID, modelID: requested, providerConfig: cfg.providers?.[builtin.providerID] }),
      }
    }

    if (requested.includes("/")) {
      const [providerID, ...rest] = requested.split("/")
      const modelID = rest.join("/")
      const apiKey = await getApiKey(providerID!)
      if (!apiKey) throw noKeyError(providerID!)
      const baseURL = await getBaseUrl(providerID!)
      return {
        providerID: providerID!,
        modelID,
        apiKey,
        baseURL,
        compat: resolveCompat({ providerID: providerID!, modelID, providerConfig: cfg.providers?.[providerID!] }),
      }
    }

    if (cfg.providers) {
      for (const [providerID, p] of Object.entries(cfg.providers)) {
        if (!p.api_key) continue
        const baseURL = p.base_url || (await getBaseUrl(providerID))
        if (!baseURL) continue
        log.info("legacy fallback: unknown model routed to first provider with base_url", { provider: providerID, model: requested })
        return {
          providerID,
          modelID: requested,
          apiKey: p.api_key,
          baseURL,
          compat: resolveCompat({ providerID, modelID: requested, providerConfig: p }),
        }
      }
    }

    throw new Error(`Unknown model: ${requested}. Run: codeblog config --list`)
  }

  function packageForCompat(compat: ModelCompatConfig): string {
    let pkg = PROVIDER_NPM[compat.api]
    if (compat.modelID.startsWith("claude-") && pkg === "@ai-sdk/openai-compatible") {
      pkg = "@ai-sdk/anthropic"
      log.info("auto-detected claude model for openai-compatible route, using anthropic sdk", { model: compat.modelID })
    }
    return pkg
  }

  function getLanguageModel(
    providerID: string,
    modelID: string,
    apiKey: string,
    npm?: string,
    baseURL?: string,
    providedCompat?: ModelCompatConfig,
    customFetch?: typeof globalThis.fetch,
  ): LanguageModel {
    const compat = providedCompat || resolveCompat({ providerID, modelID })
    const pkg = npm || packageForCompat(compat)
    const cacheKey = `${providerID}:${pkg}:${compat.cacheKey}:${apiKey.slice(0, 8)}:${baseURL || ""}`

    let sdk = sdkCache.get(cacheKey)
    if (!sdk) {
      const createFn = BUNDLED_PROVIDERS[pkg]
      if (!createFn) throw new Error(`No bundled provider for ${pkg}.`)
      const opts: Record<string, unknown> = { apiKey, name: providerID }
      if (customFetch) {
        opts.fetch = customFetch
      }
      if (baseURL) {
        const clean = baseURL.replace(/\/+$/, "")
        opts.baseURL = clean.endsWith("/v1") ? clean : `${clean}/v1`
      }
      if (pkg === "@ai-sdk/openai-compatible") {
        opts.transformRequestBody = (body: Record<string, any>) => patchRequestByCompat(compat, body)
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

  async function fetchRemoteModels(base: string, key: string): Promise<string[]> {
    try {
      const clean = base.replace(/\/+$/, "")
      const url = clean.endsWith("/v1") ? `${clean}/models` : `${clean}/v1/models`
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(8000),
      })
      if (!r.ok) return []
      const data = await r.json() as { data?: Array<{ id: string }> }
      return data.data?.map((m) => m.id) ?? []
    } catch {
      return []
    }
  }

  function noKeyError(providerID: string): Error {
    const envKeys = PROVIDER_ENV[providerID] || []
    const envHint = envKeys[0] || `${providerID.toUpperCase().replace(/-/g, "_")}_API_KEY`
    return new Error(`No API key for ${providerID}. Set ${envHint} or run: codeblog config --provider ${providerID} --api-key <key>`)
  }

  async function getConfiguredModel(): Promise<string | undefined> {
    const cfg = await Config.load()
    return resolveModelFromConfig(cfg)
  }

  export async function hasAnyKey(): Promise<boolean> {
    const loaded = await loadProviders()
    return Object.values(loaded.providers).some((p) => !!p.apiKey)
  }

  export async function available(): Promise<Array<{ model: ModelInfo; hasKey: boolean }>> {
    const result: Array<{ model: ModelInfo; hasKey: boolean }> = []
    for (const model of Object.values(BUILTIN_MODELS)) {
      const apiKey = await getApiKey(model.providerID)
      result.push({ model, hasKey: !!apiKey })
    }

    const compatKey = await getApiKey("openai-compatible")
    const compatBase = await getBaseUrl("openai-compatible")
    if (compatKey && compatBase) {
      const remoteModels = await fetchRemoteModels(compatBase, compatKey)
      for (const id of remoteModels) {
        if (BUILTIN_MODELS[id]) continue
        result.push({
          model: { id, providerID: "openai-compatible", name: id, contextWindow: 0, outputTokens: 0 },
          hasKey: true,
        })
      }
    }
    return result
  }

  export function parseModel(model: string) {
    const [providerID, ...rest] = model.split("/")
    return { providerID, modelID: rest.join("/") }
  }
}
