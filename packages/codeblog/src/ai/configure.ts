// AI provider auto-detection and configuration

function looksLikeApi(r: Response) {
  const ct = r.headers.get("content-type") || ""
  return ct.includes("json") || ct.includes("text/plain")
}

export async function probe(base: string, key: string): Promise<"openai" | "anthropic" | null> {
  const clean = base.replace(/\/+$/, "")
  try {
    const r = await fetch(`${clean}/v1/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    })
    if (r.ok || ((r.status === 401 || r.status === 403) && looksLikeApi(r))) return "openai"
  } catch {}
  try {
    const r = await fetch(`${clean}/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "test", max_tokens: 1, messages: [] }),
      signal: AbortSignal.timeout(8000),
    })
    if (r.status !== 404 && looksLikeApi(r)) return "anthropic"
  } catch {}
  return null
}

const KEY_PREFIX_MAP: Record<string, string> = {
  "sk-ant-": "anthropic",
  "AIza": "google",
  "xai-": "xai",
  "gsk_": "groq",
  "sk-or-": "openrouter",
  "pplx-": "perplexity",
}

const ENV_MAP: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  xai: "XAI_API_KEY",
  groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
  "openai-compatible": "OPENAI_COMPATIBLE_API_KEY",
}

async function fetchFirstModel(base: string, key: string): Promise<string | null> {
  try {
    const clean = base.replace(/\/+$/, "")
    const r = await fetch(`${clean}/v1/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return null
    const data = await r.json() as { data?: Array<{ id: string }> }
    if (!data.data || data.data.length === 0) return null

    // Prefer stable defaults first; avoid niche/legacy IDs unless explicitly chosen.
    const ids = data.data.map((m) => m.id)
    const preferred = [/^gpt-5\.2$/, /^claude-sonnet-4(?:-5)?/, /^gpt-5(?:\.|$|-)/, /^gpt-4o$/, /^claude-opus-4/, /^gpt-4o-mini$/, /^gemini-2\.5-flash$/]
    for (const pattern of preferred) {
      const match = ids.find((id) => pattern.test(id))
      if (match) return match
    }
    return ids[0] ?? null
  } catch {}
  return null
}

export function detectProvider(key: string) {
  for (const [prefix, provider] of Object.entries(KEY_PREFIX_MAP)) {
    if (key.startsWith(prefix)) return provider
  }
  return "openai"
}

export async function saveProvider(url: string, key: string): Promise<{ provider: string; error?: string }> {
  const { Config } = await import("../config")

  if (url) {
    const detected = await probe(url, key)
    if (!detected) return { provider: "", error: "Could not connect. Check URL and key." }

    const provider = detected === "anthropic" ? "anthropic" : "openai-compatible"
    const envKey = detected === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_COMPATIBLE_API_KEY"
    const envBase = detected === "anthropic" ? "ANTHROPIC_BASE_URL" : "OPENAI_COMPATIBLE_BASE_URL"
    process.env[envKey] = key
    process.env[envBase] = url

    const cfg = await Config.load()
    const providers = cfg.cli?.providers || {}
    providers[provider] = {
      apiKey: key,
      baseUrl: url,
      apiType: detected === "anthropic" ? "anthropic" : "openai-compatible",
      compatProfile: detected === "anthropic" ? "anthropic" : "openai-compatible",
    }

    // Auto-set model if not already configured
    const cliUpdate: Record<string, unknown> = { providers, defaultProvider: provider }
    if (!cfg.cli?.model) {
      const { defaultModelForProvider } = await import("./models")
      if (detected === "anthropic") {
        cliUpdate.model = defaultModelForProvider("anthropic")
      } else {
        // For openai-compatible with custom URL, try to fetch available models
        const model = await fetchFirstModel(url, key)
        if (model) cliUpdate.model = `openai-compatible/${model}`
        else cliUpdate.model = `openai-compatible/${defaultModelForProvider("openai-compatible")}`
      }
    }

    await Config.save({ cli: cliUpdate as Config.CliConfig })
    return { provider: `${detected} format` }
  }

  const provider = detectProvider(key)
  if (ENV_MAP[provider]) process.env[ENV_MAP[provider]] = key

  const cfg = await Config.load()
  const providers = cfg.cli?.providers || {}
  providers[provider] = {
    apiKey: key,
    apiType: provider === "anthropic" ? "anthropic" : provider === "google" ? "google" : provider === "openai" ? "openai" : "openai-compatible",
    compatProfile: provider === "anthropic" ? "anthropic" : provider === "google" ? "google" : provider === "openai" ? "openai" : "openai-compatible",
  }

  // Auto-set model for known providers
  const cliUpdate2: Record<string, unknown> = { providers, defaultProvider: provider }
  if (!cfg.cli?.model) {
    const { defaultModelForProvider } = await import("./models")
    cliUpdate2.model = defaultModelForProvider(provider)
  }

  await Config.save({ cli: cliUpdate2 as Config.CliConfig })
  return { provider }
}

export function mask(s: string) {
  if (s.length <= 8) return s
  return s.slice(0, 4) + "\u2022".repeat(Math.min(s.length - 8, 20)) + s.slice(-4)
}
