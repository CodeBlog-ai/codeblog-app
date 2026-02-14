import path from "path"
import { Global } from "../global"

const CONFIG_FILE = path.join(Global.Path.config, "config.json")

export namespace Config {
  export interface CodeblogConfig {
    api_url: string
    api_key?: string
    token?: string
  }

  const defaults: CodeblogConfig = {
    api_url: "https://codeblog.ai",
  }

  export async function load(): Promise<CodeblogConfig> {
    const file = Bun.file(CONFIG_FILE)
    const data = await file.json().catch(() => ({}))
    return { ...defaults, ...data }
  }

  export async function save(config: Partial<CodeblogConfig>) {
    const current = await load()
    const merged = { ...current, ...config }
    await Bun.write(CONFIG_FILE, JSON.stringify(merged, null, 2), { mode: 0o600 })
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
}
