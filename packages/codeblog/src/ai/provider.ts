import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { type LanguageModel } from "ai"
import { Config } from "../config"
import { Log } from "../util/log"

const log = Log.create({ service: "ai-provider" })

export namespace AIProvider {
  export type ProviderID = "anthropic" | "openai" | "google"

  export interface ModelInfo {
    id: string
    providerID: ProviderID
    name: string
    contextWindow: number
    outputTokens: number
  }

  export const MODELS: Record<string, ModelInfo> = {
    "claude-sonnet-4-20250514": {
      id: "claude-sonnet-4-20250514",
      providerID: "anthropic",
      name: "Claude Sonnet 4",
      contextWindow: 200000,
      outputTokens: 16384,
    },
    "claude-3-5-haiku-20241022": {
      id: "claude-3-5-haiku-20241022",
      providerID: "anthropic",
      name: "Claude 3.5 Haiku",
      contextWindow: 200000,
      outputTokens: 8192,
    },
    "gpt-4o": {
      id: "gpt-4o",
      providerID: "openai",
      name: "GPT-4o",
      contextWindow: 128000,
      outputTokens: 16384,
    },
    "gpt-4o-mini": {
      id: "gpt-4o-mini",
      providerID: "openai",
      name: "GPT-4o Mini",
      contextWindow: 128000,
      outputTokens: 16384,
    },
    "gemini-2.5-flash": {
      id: "gemini-2.5-flash",
      providerID: "google",
      name: "Gemini 2.5 Flash",
      contextWindow: 1048576,
      outputTokens: 65536,
    },
  }

  export const DEFAULT_MODEL = "claude-sonnet-4-20250514"

  export async function getApiKey(providerID: ProviderID): Promise<string | undefined> {
    const env: Record<ProviderID, string> = {
      anthropic: "ANTHROPIC_API_KEY",
      openai: "OPENAI_API_KEY",
      google: "GOOGLE_GENERATIVE_AI_API_KEY",
    }
    const envKey = process.env[env[providerID]]
    if (envKey) return envKey

    const cfg = await Config.load()
    const providers = (cfg as Record<string, unknown>).providers as Record<string, { api_key?: string }> | undefined
    return providers?.[providerID]?.api_key
  }

  export async function getModel(modelID?: string): Promise<LanguageModel> {
    const id = modelID || (await getConfiguredModel()) || DEFAULT_MODEL
    const info = MODELS[id]
    if (!info) throw new Error(`Unknown model: ${id}. Available: ${Object.keys(MODELS).join(", ")}`)

    const apiKey = await getApiKey(info.providerID)
    if (!apiKey) {
      throw new Error(
        `No API key for ${info.providerID}. Set ${info.providerID === "anthropic" ? "ANTHROPIC_API_KEY" : info.providerID === "openai" ? "OPENAI_API_KEY" : "GOOGLE_GENERATIVE_AI_API_KEY"} or run: codeblog config --provider ${info.providerID} --api-key <key>`,
      )
    }

    log.info("loading model", { model: id, provider: info.providerID })

    if (info.providerID === "anthropic") {
      const provider = createAnthropic({ apiKey })
      return provider(id)
    }
    if (info.providerID === "openai") {
      const provider = createOpenAI({ apiKey })
      return provider(id)
    }
    if (info.providerID === "google") {
      const provider = createGoogleGenerativeAI({ apiKey })
      return provider(id)
    }
    throw new Error(`Unsupported provider: ${info.providerID}`)
  }

  async function getConfiguredModel(): Promise<string | undefined> {
    const cfg = await Config.load()
    return (cfg as Record<string, unknown>).model as string | undefined
  }

  export async function available(): Promise<Array<{ model: ModelInfo; hasKey: boolean }>> {
    const result: Array<{ model: ModelInfo; hasKey: boolean }> = []
    for (const model of Object.values(MODELS)) {
      const key = await getApiKey(model.providerID)
      result.push({ model, hasKey: !!key })
    }
    return result
  }
}
