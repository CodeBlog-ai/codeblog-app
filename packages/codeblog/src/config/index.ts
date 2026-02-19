import path from "path"
import { chmod, writeFile } from "fs/promises"
import { Global } from "../global"

const CONFIG_FILE = path.join(Global.Path.config, "config.json")

export namespace Config {
  export type ModelApi = "anthropic" | "openai" | "google" | "openai-compatible"
  export type CompatProfile = "anthropic" | "openai" | "openai-compatible" | "google"

  export interface FeatureFlags {
    ai_provider_registry_v2?: boolean
    ai_onboarding_wizard_v2?: boolean
  }

  export interface ProviderConfig {
    api_key: string
    base_url?: string
    api?: ModelApi
    compat_profile?: CompatProfile
  }

  export interface CodeblogConfig {
    api_url: string
    api_key?: string
    token?: string
    model?: string
    default_provider?: string
    default_language?: string
    activeAgent?: string
    active_agents?: Record<string, string>
    providers?: Record<string, ProviderConfig>
    feature_flags?: FeatureFlags
  }

  const defaults: CodeblogConfig = {
    api_url: "https://codeblog.ai",
  }

  export const filepath = CONFIG_FILE

  const FEATURE_FLAG_ENV: Record<keyof FeatureFlags, string> = {
    ai_provider_registry_v2: "CODEBLOG_AI_PROVIDER_REGISTRY_V2",
    ai_onboarding_wizard_v2: "CODEBLOG_AI_ONBOARDING_WIZARD_V2",
  }

  export async function load(): Promise<CodeblogConfig> {
    const file = Bun.file(CONFIG_FILE)
    const data = await file.json().catch(() => ({}))
    return { ...defaults, ...data }
  }

  export async function save(config: Partial<CodeblogConfig>) {
    const current = await load()
    const merged = { ...current, ...config }
    await writeFile(CONFIG_FILE, JSON.stringify(merged, null, 2))
    await chmod(CONFIG_FILE, 0o600).catch(() => {})
  }

  export async function getActiveAgent(username?: string) {
    const cfg = await load()
    if (username) return cfg.active_agents?.[username] || ""
    return cfg.activeAgent || ""
  }

  export async function saveActiveAgent(agent: string, username?: string) {
    if (!agent.trim()) return
    if (!username) {
      await save({ activeAgent: agent })
      return
    }
    const cfg = await load()
    await save({
      active_agents: {
        ...(cfg.active_agents || {}),
        [username]: agent,
      },
    })
  }

  export async function clearActiveAgent(username?: string) {
    if (!username) {
      await save({ activeAgent: "", active_agents: {} })
      return
    }
    const cfg = await load()
    const map = { ...(cfg.active_agents || {}) }
    delete map[username]
    await save({ active_agents: map })
  }

  export async function url() {
    return process.env.CODEBLOG_URL || (await load()).api_url || "https://codeblog.ai"
  }

  export async function key() {
    return process.env.CODEBLOG_API_KEY || (await load()).api_key || ""
  }

  export async function token() {
    return process.env.CODEBLOG_TOKEN || (await load()).token || ""
  }

  export async function language() {
    return process.env.CODEBLOG_LANGUAGE || (await load()).default_language
  }

  function parseBool(raw: string | undefined): boolean | undefined {
    if (!raw) return undefined
    const v = raw.trim().toLowerCase()
    if (["1", "true", "yes", "on"].includes(v)) return true
    if (["0", "false", "no", "off"].includes(v)) return false
    return undefined
  }

  export function envFlagName(flag: keyof FeatureFlags): string {
    return FEATURE_FLAG_ENV[flag]
  }

  export async function featureEnabled(flag: keyof FeatureFlags): Promise<boolean> {
    const env = parseBool(process.env[FEATURE_FLAG_ENV[flag]])
    if (env !== undefined) return env
    return !!(await load()).feature_flags?.[flag]
  }
}
