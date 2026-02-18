import { Config } from "../config"
import { Log } from "../util/log"
import { BUILTIN_MODELS, DEFAULT_MODEL, inferProviderByModelPrefix } from "./models"
import { type ModelCompatConfig, resolveCompat } from "./types"

const log = Log.create({ service: "ai-provider-registry" })

export const PROVIDER_ENV: Record<string, string[]> = {
  anthropic: ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"],
  openai: ["OPENAI_API_KEY"],
  google: ["GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEY"],
  "openai-compatible": ["OPENAI_COMPATIBLE_API_KEY"],
}

export const PROVIDER_BASE_URL_ENV: Record<string, string[]> = {
  anthropic: ["ANTHROPIC_BASE_URL"],
  openai: ["OPENAI_BASE_URL", "OPENAI_API_BASE"],
  google: ["GOOGLE_API_BASE_URL"],
  "openai-compatible": ["OPENAI_COMPATIBLE_BASE_URL"],
}

export interface ProviderRuntimeConfig {
  id: string
  apiKey?: string
  baseURL?: string
  config?: Config.ProviderConfig
}

export interface ProviderRegistryView {
  providers: Record<string, ProviderRuntimeConfig>
  defaultProvider?: string
}

export interface ModelRoute {
  requestedModel: string
  providerID: string
  modelID: string
  apiKey: string
  baseURL?: string
  compat: ModelCompatConfig
}

function readFirstEnv(keys: string[]): string | undefined {
  for (const key of keys) {
    if (process.env[key]) return process.env[key]
  }
  return undefined
}

export async function loadProviders(cfgInput?: Config.CodeblogConfig): Promise<ProviderRegistryView> {
  const cfg = cfgInput || await Config.load()
  const user = cfg.providers || {}
  const ids = new Set<string>([
    ...Object.keys(PROVIDER_ENV),
    ...Object.keys(user),
  ])

  const providers: Record<string, ProviderRuntimeConfig> = {}

  for (const id of ids) {
    const config = user[id]
    providers[id] = {
      id,
      config,
      apiKey: readFirstEnv(PROVIDER_ENV[id] || []) || config?.api_key,
      baseURL: readFirstEnv(PROVIDER_BASE_URL_ENV[id] || []) || config?.base_url,
    }
  }

  return { providers, defaultProvider: cfg.default_provider }
}

function availableProvidersWithKeys(providers: Record<string, ProviderRuntimeConfig>): string[] {
  return Object.values(providers)
    .filter((p) => p.apiKey)
    .map((p) => p.id)
    .sort()
}

function unknownModelError(modelID: string, providers: Record<string, ProviderRuntimeConfig>): Error {
  const available = availableProvidersWithKeys(providers)
  const base = `Unknown model "${modelID}".`
  if (available.length === 0) {
    return new Error(`${base} No AI providers are configured. Run: codeblog ai setup`)
  }
  return new Error(`${base} Available providers with keys: ${available.join(", ")}. Try: codeblog config --model <provider>/<model>`)
}

function noKeyError(providerID: string, modelID: string): Error {
  const envKeys = PROVIDER_ENV[providerID] || []
  const envHint = envKeys[0] || `${providerID.toUpperCase().replace(/-/g, "_")}_API_KEY`
  return new Error(`No API key for ${providerID} (model: ${modelID}). Set ${envHint} or run: codeblog config --provider ${providerID} --api-key <key>`)
}

function routeViaProvider(
  providers: Record<string, ProviderRuntimeConfig>,
  requestedModel: string,
  providerID: string,
  modelID: string,
): ModelRoute {
  const provider = providers[providerID]
  if (!provider) throw unknownModelError(requestedModel, providers)
  if (!provider.apiKey) throw noKeyError(providerID, modelID)

  const compat = resolveCompat({ providerID, modelID, providerConfig: provider.config })
  return {
    requestedModel,
    providerID,
    modelID,
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
    compat,
  }
}

export async function routeModel(inputModel?: string, cfgInput?: Config.CodeblogConfig): Promise<ModelRoute> {
  const cfg = cfgInput || await Config.load()
  const requestedModel = inputModel || cfg.model || DEFAULT_MODEL
  const loaded = await loadProviders(cfg)
  const providers = loaded.providers

  if (requestedModel.includes("/")) {
    const [providerID, ...rest] = requestedModel.split("/")
    const modelID = rest.join("/")
    return routeViaProvider(providers, requestedModel, providerID!, modelID)
  }

  if (BUILTIN_MODELS[requestedModel]) {
    const providerID = BUILTIN_MODELS[requestedModel]!.providerID
    return routeViaProvider(providers, requestedModel, providerID, requestedModel)
  }

  const prefixed = inferProviderByModelPrefix(requestedModel)
  if (prefixed) {
    return routeViaProvider(providers, requestedModel, prefixed, requestedModel)
  }

  if (loaded.defaultProvider) {
    return routeViaProvider(providers, requestedModel, loaded.defaultProvider, requestedModel)
  }

  log.warn("route failed", { requestedModel })
  throw unknownModelError(requestedModel, providers)
}

export async function resolveProviderCompat(providerID: string, modelID: string, cfgInput?: Config.CodeblogConfig): Promise<ModelCompatConfig> {
  const loaded = await loadProviders(cfgInput)
  const provider = loaded.providers[providerID]
  return resolveCompat({ providerID, modelID, providerConfig: provider?.config })
}
