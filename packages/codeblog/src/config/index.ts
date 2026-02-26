import path from "path"
import { chmod, writeFile } from "fs/promises"
import { Global } from "../global"

const CONFIG_FILE = path.join(Global.Path.config, "config.json")

export namespace Config {
  export type ApiType = "anthropic" | "openai" | "google" | "openai-compatible"
  export type CompatProfile = "anthropic" | "openai" | "openai-compatible" | "google"

  export interface AuthConfig {
    apiKey?: string
    activeAgent?: string
    userId?: string
    username?: string
  }

  export interface ProviderConfig {
    apiKey: string
    baseUrl?: string
    apiType?: ApiType
    compatProfile?: CompatProfile
  }

  export interface FeatureFlags {
    aiProviderRegistryV2?: boolean
    aiOnboardingWizardV2?: boolean
  }

  export interface CompanionConfig {
    enabled?: boolean
    intervalMinutes?: number  // default 120
    minSessionMessages?: number  // default 10, skip sessions shorter than this
  }

  export interface CliConfig {
    model?: string
    defaultProvider?: string
    defaultLanguage?: string
    dailyReportHour?: number
    providers?: Record<string, ProviderConfig>
    featureFlags?: FeatureFlags
  }

  export interface CodeblogConfig {
    serverUrl?: string
    dailyReportHour?: number
    auth?: AuthConfig
    cli?: CliConfig
    companion?: CompanionConfig
  }

  const defaults: CodeblogConfig = {
    serverUrl: "https://codeblog.ai",
  }

  export const filepath = CONFIG_FILE

  const FEATURE_FLAG_ENV: Record<keyof FeatureFlags, string> = {
    aiProviderRegistryV2: "CODEBLOG_AI_PROVIDER_REGISTRY_V2",
    aiOnboardingWizardV2: "CODEBLOG_AI_ONBOARDING_WIZARD_V2",
  }

  function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
    const result = { ...target }
    for (const key of Object.keys(source)) {
      const val = source[key]
      if (val === undefined) {
        delete result[key]
      } else if (typeof val === "object" && !Array.isArray(val) && val !== null) {
        result[key] = deepMerge((result[key] as Record<string, any>) || {}, val)
      } else {
        result[key] = val
      }
    }
    return result
  }

  export async function load(): Promise<CodeblogConfig> {
    const file = Bun.file(CONFIG_FILE)
    const data = await file.json().catch(() => ({}))
    return deepMerge(defaults, data) as CodeblogConfig
  }

  export async function save(config: Partial<CodeblogConfig>) {
    const current = await load()
    const merged = deepMerge(current, config as Record<string, any>)
    await writeFile(CONFIG_FILE, JSON.stringify(merged, null, 2))
    await chmod(CONFIG_FILE, 0o600).catch(() => {})
  }

  // --- Auth helpers ---

  export async function getActiveAgent(_username?: string) {
    const cfg = await load()
    return cfg.auth?.activeAgent || ""
  }

  export async function saveActiveAgent(agent: string, _username?: string) {
    if (!agent.trim()) return
    await save({ auth: { activeAgent: agent } })
  }

  export async function clearActiveAgent(_username?: string) {
    await save({ auth: { activeAgent: undefined } })
  }

  // --- Server helpers ---

  export async function url() {
    return process.env.CODEBLOG_URL || (await load()).serverUrl || "https://codeblog.ai"
  }

  export async function key() {
    return process.env.CODEBLOG_API_KEY || (await load()).auth?.apiKey || ""
  }

  export async function language() {
    return process.env.CODEBLOG_LANGUAGE || (await load()).cli?.defaultLanguage
  }

  export async function dailyReportHour(): Promise<number> {
    const val = (await load()).dailyReportHour
    return val !== undefined ? val : 22
  }

  // --- Feature flags ---

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
    return !!(await load()).cli?.featureFlags?.[flag]
  }
}
