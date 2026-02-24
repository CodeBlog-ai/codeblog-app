import type { Config } from "../config"

export type ModelApi = "anthropic" | "openai" | "google" | "openai-compatible"
export type CompatProfile = "anthropic" | "openai" | "openai-compatible" | "google"

export interface ModelCompatConfig {
  providerID: string
  modelID: string
  api: ModelApi
  compatProfile: CompatProfile
  cacheKey: string
  stripParallelToolCalls: boolean
  normalizeToolSchema: boolean
}

export const COMPAT_PRESETS: Record<CompatProfile, Omit<ModelCompatConfig, "providerID" | "modelID" | "cacheKey">> = {
  anthropic: {
    api: "anthropic",
    compatProfile: "anthropic",
    stripParallelToolCalls: false,
    normalizeToolSchema: false,
  },
  openai: {
    api: "openai",
    compatProfile: "openai",
    stripParallelToolCalls: false,
    normalizeToolSchema: false,
  },
  google: {
    api: "google",
    compatProfile: "google",
    stripParallelToolCalls: false,
    normalizeToolSchema: false,
  },
  "openai-compatible": {
    api: "openai-compatible",
    compatProfile: "openai-compatible",
    stripParallelToolCalls: true,
    normalizeToolSchema: true,
  },
}

function isOfficialOpenAIBase(baseURL?: string): boolean {
  if (!baseURL) return false
  try {
    return new URL(baseURL).hostname === "api.openai.com"
  } catch {
    return false
  }
}

function resolveApiFromProvider(providerID: string, cfg?: Config.ProviderConfig): ModelApi {
  if (providerID === "openai" && cfg?.baseUrl && !isOfficialOpenAIBase(cfg.baseUrl)) {
    return "openai-compatible"
  }
  if (cfg?.apiType) return cfg.apiType
  if (providerID === "anthropic") return "anthropic"
  if (providerID === "openai") return "openai"
  if (providerID === "google") return "google"
  if (providerID === "openai-compatible") return "openai-compatible"
  return "openai-compatible"
}

function defaultCompatForApi(api: ModelApi): CompatProfile {
  if (api === "anthropic") return "anthropic"
  if (api === "openai") return "openai"
  if (api === "google") return "google"
  return "openai-compatible"
}

export function resolveCompat(args: {
  providerID: string
  modelID: string
  providerConfig?: Config.ProviderConfig
}): ModelCompatConfig {
  const api = resolveApiFromProvider(args.providerID, args.providerConfig)
  const configured = args.providerConfig?.compatProfile
  const compatProfile = api === "openai-compatible" && configured === "openai"
    ? "openai-compatible"
    : configured || defaultCompatForApi(api)
  const preset = COMPAT_PRESETS[compatProfile]
  return {
    ...preset,
    providerID: args.providerID,
    modelID: args.modelID,
    cacheKey: `${api}:${compatProfile}`,
  }
}

export function patchRequestByCompat(compat: ModelCompatConfig, body: Record<string, any>): Record<string, any> {
  if (compat.stripParallelToolCalls) {
    delete body.parallel_tool_calls
  }

  if (compat.normalizeToolSchema && Array.isArray(body.tools)) {
    for (const t of body.tools) {
      const params = t?.function?.parameters
      if (!params || typeof params !== "object") continue
      if (!params.type) params.type = "object"
      if (params.type === "object" && !params.properties) params.properties = {}
    }
  }

  return body
}
