import type { CommandModule } from "yargs"
import { Auth } from "../../auth"
import { OAuth, lastAuthHasAgents, lastAuthAgentsCount } from "../../auth/oauth"
import { McpBridge } from "../../mcp/client"
import { UI } from "../ui"
import { Config } from "../../config"

export let setupCompleted = false

// ─── Auth ────────────────────────────────────────────────────────────────────

async function authBrowser(): Promise<boolean> {
  try {
    console.log(`  ${UI.Style.TEXT_DIM}Opening browser for login...${UI.Style.TEXT_NORMAL}`)

    await OAuth.login({
      onUrl: (url) => {
        console.log(`  ${UI.Style.TEXT_DIM}If the browser didn't open, visit:${UI.Style.TEXT_NORMAL}`)
        console.log(`  ${UI.Style.TEXT_HIGHLIGHT}${url}${UI.Style.TEXT_NORMAL}`)
        console.log("")
        console.log(`  ${UI.Style.TEXT_DIM}Waiting for authentication...${UI.Style.TEXT_NORMAL}`)
      },
    })

    return true
  } catch (err) {
    UI.error(`Authentication failed: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

// ─── Scan & Publish ──────────────────────────────────────────────────────────

async function shimmerLine(text: string, durationMs = 2000): Promise<void> {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
  const startTime = Date.now()
  let i = 0
  while (Date.now() - startTime < durationMs) {
    Bun.stderr.write(`\r  ${UI.Style.TEXT_HIGHLIGHT}${frames[i % frames.length]}${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}${text}${UI.Style.TEXT_NORMAL}`)
    i++
    await Bun.sleep(80)
  }
  Bun.stderr.write(`\r  ${UI.Style.TEXT_SUCCESS}✓${UI.Style.TEXT_NORMAL} ${text}\n`)
}

async function scanAndPublish(): Promise<void> {
  // Scan with shimmer animation
  const scanPromise = McpBridge.callTool("scan_sessions", { limit: 10 })
  await shimmerLine("Scanning local IDE sessions...", 1500)

  let sessions: Array<{ id: string; source: string; project: string; title: string }>
  try {
    const text = await scanPromise
    try {
      sessions = JSON.parse(text)
    } catch {
      console.log(`  ${text}`)
      return
    }
  } catch (err) {
    UI.warn(`Could not scan sessions: ${err instanceof Error ? err.message : String(err)}`)
    await UI.typeText("No worries — you can scan later with /scan in the app.")
    return
  }

  if (sessions.length === 0) {
    await UI.typeText("No IDE sessions found yet. That's okay!")
    await UI.typeText("You can scan later with /scan once you've used an AI-powered IDE.")
    return
  }

  // Show what we found
  const sources = [...new Set(sessions.map((s) => s.source))]
  console.log("")
  await UI.typeText(
    `Found ${sessions.length} session${sessions.length > 1 ? "s" : ""} across ${sources.length} IDE${sources.length > 1 ? "s" : ""}: ${sources.join(", ")}`,
    { charDelay: 10 },
  )
  console.log("")

  for (const s of sessions.slice(0, 3)) {
    console.log(`  ${UI.Style.TEXT_INFO}[${s.source}]${UI.Style.TEXT_NORMAL} ${s.project} — ${s.title.slice(0, 60)}`)
  }
  if (sessions.length > 3) {
    console.log(`  ${UI.Style.TEXT_DIM}... and ${sessions.length - 3} more${UI.Style.TEXT_NORMAL}`)
  }
  console.log("")

  // Analyze with shimmer — show the thinking process step by step
  await shimmerLine("Analyzing sessions for interesting insights...", 1200)

  // Dry run — preview (with shimmer while waiting)
  let preview: string
  try {
    const postPromise = McpBridge.callTool("auto_post", { dry_run: true })
    await shimmerLine("Crafting a blog post from your best session...", 2000)
    preview = await postPromise
  } catch (err) {
    UI.warn(`Could not generate post: ${err instanceof Error ? err.message : String(err)}`)
    await UI.typeText("You can try again later with /publish in the app.")
    return
  }

  // Display preview with structured layout
  const cleaned = UI.cleanMarkdown(preview)
  console.log("")
  UI.divider()

  // Parse out key fields for better display
  const lines = cleaned.split("\n")
  let title = ""
  let tags = ""
  let category = ""
  const bodyLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("DRY RUN") || trimmed === "---" || trimmed.match(/^─+$/)) continue
    if (trimmed.startsWith("Title:")) { title = trimmed.replace("Title:", "").trim(); continue }
    if (trimmed.startsWith("Tags:")) { tags = trimmed.replace("Tags:", "").trim(); continue }
    if (trimmed.startsWith("Category:")) { category = trimmed.replace("Category:", "").trim(); continue }
    if (trimmed.startsWith("Session:")) continue
    bodyLines.push(trimmed)
  }

  // Structured display
  if (title) {
    console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}📝 ${title}${UI.Style.TEXT_NORMAL}`)
    console.log("")
  }
  if (category || tags) {
    const meta: string[] = []
    if (category) meta.push(`Category: ${category}`)
    if (tags) meta.push(`Tags: ${tags}`)
    console.log(`  ${UI.Style.TEXT_DIM}${meta.join("  ·  ")}${UI.Style.TEXT_NORMAL}`)
    console.log("")
  }
  if (bodyLines.length > 0) {
    // Show a preview snippet (first few meaningful lines)
    const snippet = bodyLines.slice(0, 6)
    for (const line of snippet) {
      console.log(`  ${line}`)
    }
    if (bodyLines.length > 6) {
      console.log(`  ${UI.Style.TEXT_DIM}... (${bodyLines.length - 6} more lines)${UI.Style.TEXT_NORMAL}`)
    }
  }

  UI.divider()

  // Confirm publish
  const choice = await UI.waitEnter("Press Enter to publish, or Esc to skip")

  if (choice === "escape") {
    await UI.typeText("Skipped. You can publish later with /publish in the app.")
    return
  }

  // Publish with shimmer
  const publishPromise = McpBridge.callTool("auto_post", { dry_run: false })
  await shimmerLine("Publishing your post...", 1500)

  try {
    const result = await publishPromise
    console.log("")

    // Extract URL and details from result
    const urlMatch = result.match(/(?:URL|View at|view at)[:\s]*(https?:\/\/\S+)/i)
    if (urlMatch) {
      UI.success("Post published successfully!")
      console.log("")
      if (title) {
        console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}${title}${UI.Style.TEXT_NORMAL}`)
      }
      console.log(`  ${UI.Style.TEXT_HIGHLIGHT}${urlMatch[1]}${UI.Style.TEXT_NORMAL}`)
      console.log("")
      await UI.typeText("Your first post is live! Others can now read, comment, and vote on it.", { charDelay: 10 })
    } else {
      UI.success("Post published!")
      // Fallback: show cleaned result
      const cleanResult = UI.cleanMarkdown(result)
      for (const line of cleanResult.split("\n").slice(0, 5)) {
        if (line.trim()) console.log(`  ${line.trim()}`)
      }
    }
  } catch (err) {
    UI.error(`Publish failed: ${err instanceof Error ? err.message : String(err)}`)
    await UI.typeText("You can try again later with /publish.")
  }
}

// ─── AI Configuration ────────────────────────────────────────────────────────

async function aiQuickConfigPrompt(): Promise<void> {
  const { AIProvider } = await import("../../ai/provider")
  const hasKey = await AIProvider.hasAnyKey()

  if (hasKey) {
    UI.success("AI provider already configured!")
    return
  }

  UI.divider()

  await UI.typeText("One more thing — would you like to configure an AI chat provider?")
  console.log("")
  await UI.typeText("With AI configured, you can interact with the forum using natural language:", { charDelay: 8 })
  console.log(`    ${UI.Style.TEXT_DIM}"Show me trending posts about TypeScript"${UI.Style.TEXT_NORMAL}`)
  console.log(`    ${UI.Style.TEXT_DIM}"Analyze my latest coding session"${UI.Style.TEXT_NORMAL}`)
  console.log(`    ${UI.Style.TEXT_DIM}"Write a post about my React refactoring"${UI.Style.TEXT_NORMAL}`)
  console.log("")

  const choice = await UI.waitEnter("Press Enter to configure AI, or Esc to skip")

  if (choice === "escape") {
    console.log("")
    await UI.typeText("No problem! You can configure AI later with /ai in the app.")
    console.log("")
    await UI.typeText("Even without AI, you can use slash commands to interact:", { charDelay: 8 })
    console.log(`    ${UI.Style.TEXT_HIGHLIGHT}/scan${UI.Style.TEXT_NORMAL}      ${UI.Style.TEXT_DIM}Scan IDE sessions${UI.Style.TEXT_NORMAL}`)
    console.log(`    ${UI.Style.TEXT_HIGHLIGHT}/publish${UI.Style.TEXT_NORMAL}   ${UI.Style.TEXT_DIM}Publish a post${UI.Style.TEXT_NORMAL}`)
    console.log(`    ${UI.Style.TEXT_HIGHLIGHT}/feed${UI.Style.TEXT_NORMAL}      ${UI.Style.TEXT_DIM}Browse the forum${UI.Style.TEXT_NORMAL}`)
    console.log(`    ${UI.Style.TEXT_HIGHLIGHT}/theme${UI.Style.TEXT_NORMAL}     ${UI.Style.TEXT_DIM}Change color theme${UI.Style.TEXT_NORMAL}`)
    return
  }

  // AI config flow: URL → Key with ESC support
  console.log("")
  console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}API URL${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}(or press Enter to skip URL, Esc to cancel):${UI.Style.TEXT_NORMAL}`)
  const urlResult = await UI.inputWithEscape(`  ${UI.Style.TEXT_HIGHLIGHT}❯ ${UI.Style.TEXT_NORMAL}`)

  if (urlResult === null) {
    // User pressed Esc
    console.log("")
    await UI.typeText("Skipped AI configuration. You can configure later with /ai in the app.")
    return
  }

  const url = urlResult.trim()

  console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}API Key${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}(press Esc to cancel):${UI.Style.TEXT_NORMAL}`)
  const keyResult = await UI.inputWithEscape(`  ${UI.Style.TEXT_HIGHLIGHT}❯ ${UI.Style.TEXT_NORMAL}`)

  if (keyResult === null) {
    // User pressed Esc
    console.log("")
    await UI.typeText("Skipped AI configuration. You can configure later with /ai in the app.")
    return
  }

  const key = keyResult.trim()

  // Both empty → friendly skip
  if (!url && !key) {
    console.log("")
    UI.info("No AI configuration provided — skipping for now.")
    await UI.typeText("You can configure AI later with /ai in the app.")
    return
  }

  // Key empty but URL provided → friendly skip
  if (!key) {
    console.log("")
    UI.info("No API key provided — skipping AI configuration.")
    await UI.typeText("You can configure AI later with /ai in the app.")
    return
  }

  if (key.length < 5) {
    UI.warn("API key seems too short, skipping AI configuration.")
    await UI.typeText("You can configure AI later with /ai in the app.")
    return
  }

  try {
    const { saveProvider } = await import("../../ai/configure")
    await shimmerLine("Detecting API format...", 1500)
    const result = await saveProvider(url, key)
    if (result.error) {
      UI.warn(result.error)
      await UI.typeText("You can try again later with /ai in the app.")
    } else {
      UI.success(`AI configured! (${result.provider})`)
    }
  } catch (err) {
    UI.warn(`Configuration failed: ${err instanceof Error ? err.message : String(err)}`)
    await UI.typeText("You can try again later with /ai in the app.")
  }
}

type WizardMode = "quick" | "manual"

interface ProviderChoice {
  name: string
  providerID: string
  api: "anthropic" | "openai" | "google" | "openai-compatible"
  baseURL?: string
  hint?: string
}

const PROVIDER_CHOICES: ProviderChoice[] = [
  { name: "OpenAI", providerID: "openai", api: "openai", baseURL: "https://api.openai.com", hint: "Codex OAuth + API key style" },
  { name: "Anthropic", providerID: "anthropic", api: "anthropic", baseURL: "https://api.anthropic.com", hint: "Claude API key" },
  { name: "Google", providerID: "google", api: "google", baseURL: "https://generativelanguage.googleapis.com", hint: "Gemini API key" },
  { name: "OpenRouter", providerID: "openai-compatible", api: "openai-compatible", baseURL: "https://openrouter.ai/api", hint: "OpenAI-compatible" },
  { name: "vLLM", providerID: "openai-compatible", api: "openai-compatible", baseURL: "http://127.0.0.1:8000", hint: "Local/self-hosted OpenAI-compatible" },
  { name: "MiniMax", providerID: "openai-compatible", api: "openai-compatible", baseURL: "https://api.minimax.io", hint: "OpenAI-compatible endpoint" },
  { name: "Moonshot AI (Kimi K2.5)", providerID: "openai-compatible", api: "openai-compatible", baseURL: "https://api.moonshot.ai", hint: "OpenAI-compatible endpoint" },
  { name: "xAI (Grok)", providerID: "openai-compatible", api: "openai-compatible", baseURL: "https://api.x.ai", hint: "OpenAI-compatible endpoint" },
  { name: "Qianfan", providerID: "openai-compatible", api: "openai-compatible", baseURL: "https://qianfan.baidubce.com", hint: "OpenAI-compatible endpoint" },
  { name: "Vercel AI Gateway", providerID: "openai-compatible", api: "openai-compatible", baseURL: "https://ai-gateway.vercel.sh", hint: "OpenAI-compatible endpoint" },
  { name: "OpenCode Zen", providerID: "openai-compatible", api: "openai-compatible", baseURL: "https://opencode.ai/zen", hint: "OpenAI-compatible endpoint" },
  { name: "Xiaomi", providerID: "anthropic", api: "anthropic", baseURL: "https://api.xiaomimimo.com/anthropic", hint: "Anthropic-compatible endpoint" },
  { name: "Synthetic", providerID: "anthropic", api: "anthropic", baseURL: "https://api.synthetic.new", hint: "Anthropic-compatible endpoint" },
  { name: "Together AI", providerID: "openai-compatible", api: "openai-compatible", baseURL: "https://api.together.xyz", hint: "OpenAI-compatible endpoint" },
  { name: "Hugging Face", providerID: "openai-compatible", api: "openai-compatible", baseURL: "https://router.huggingface.co", hint: "OpenAI-compatible endpoint" },
  { name: "Venice AI", providerID: "openai-compatible", api: "openai-compatible", baseURL: "https://api.venice.ai/api", hint: "OpenAI-compatible endpoint" },
  { name: "LiteLLM", providerID: "openai-compatible", api: "openai-compatible", baseURL: "http://localhost:4000", hint: "Unified OpenAI-compatible gateway" },
  { name: "Cloudflare AI Gateway", providerID: "anthropic", api: "anthropic", hint: "Enter full Anthropic gateway URL manually" },
  { name: "Custom Provider", providerID: "openai-compatible", api: "openai-compatible", hint: "Any OpenAI-compatible URL" },
]

async function fetchOpenAIModels(baseURL: string, key: string): Promise<string[]> {
  try {
    const clean = baseURL.replace(/\/+$/, "")
    const url = clean.endsWith("/v1") ? `${clean}/models` : `${clean}/v1/models`
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return []
    const data = await r.json() as { data?: Array<{ id: string }> }
    return data.data?.map((m) => m.id) || []
  } catch {
    return []
  }
}

function pickPreferredRemoteModel(models: string[]): string | undefined {
  if (models.length === 0) return undefined
  const preferred = [/^gpt-5\.2$/, /^claude-sonnet-4(?:-5)?/, /^gpt-5(?:\.|$|-)/, /^gpt-4o$/, /^gpt-4o-mini$/, /^gemini-2\.5-flash$/]
  for (const pattern of preferred) {
    const found = models.find((id) => pattern.test(id))
    if (found) return found
  }
  return models[0]
}

function isOfficialOpenAIBase(baseURL: string): boolean {
  try {
    const u = new URL(baseURL)
    return u.hostname === "api.openai.com"
  } catch {
    return false
  }
}

async function verifyEndpoint(choice: ProviderChoice, baseURL: string, key: string): Promise<{ ok: boolean; detail: string; detectedApi?: Config.ModelApi }> {
  try {
    if (choice.api === "anthropic") {
      const clean = baseURL.replace(/\/+$/, "")
      const r = await fetch(`${clean}/v1/messages`, {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: "claude-3-5-haiku-latest", max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
        signal: AbortSignal.timeout(8000),
      })
      if (r.status !== 404) return { ok: true, detail: `Anthropic endpoint reachable (${r.status})`, detectedApi: "anthropic" }
      return { ok: false, detail: "Anthropic endpoint returned 404" }
    }

    if (choice.api === "google") {
      const clean = baseURL.replace(/\/+$/, "")
      const r = await fetch(`${clean}/v1beta/models?key=${encodeURIComponent(key)}`, {
        signal: AbortSignal.timeout(8000),
      })
      if (r.ok || r.status === 401 || r.status === 403) return { ok: true, detail: `Google endpoint reachable (${r.status})` }
      return { ok: false, detail: `Google endpoint responded ${r.status}` }
    }

    const { probe } = await import("../../ai/configure")
    const detected = await probe(baseURL, key)
    if (detected === "anthropic") return { ok: true, detail: "Detected Anthropic API format", detectedApi: "anthropic" }
    if (detected === "openai") {
      const detectedApi: Config.ModelApi =
        choice.providerID === "openai" && isOfficialOpenAIBase(baseURL)
          ? "openai"
          : "openai-compatible"
      return { ok: true, detail: "Detected OpenAI API format", detectedApi }
    }

    const models = await fetchOpenAIModels(baseURL, key)
    if (models.length > 0) {
      const detectedApi: Config.ModelApi =
        choice.providerID === "openai" && isOfficialOpenAIBase(baseURL)
          ? "openai"
          : "openai-compatible"
      return { ok: true, detail: `Model endpoint reachable (${models.length} models)`, detectedApi }
    }

    return { ok: false, detail: "Could not detect endpoint format or list models" }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

async function chooseProvider(): Promise<ProviderChoice | undefined> {
  console.log("")
  console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Model/auth provider${UI.Style.TEXT_NORMAL}`)
  const idx = await UI.select(
    "  Choose a provider",
    [...PROVIDER_CHOICES.map((p) => p.hint ? `${p.name} (${p.hint})` : p.name), "Skip for now"],
  )
  if (idx < 0 || idx >= PROVIDER_CHOICES.length) return undefined
  return PROVIDER_CHOICES[idx]
}

async function chooseModel(choice: ProviderChoice, mode: WizardMode, baseURL: string, key: string): Promise<string | undefined> {
  const { AIProvider } = await import("../../ai/provider")
  const builtin = Object.values(AIProvider.BUILTIN_MODELS).filter((m) => m.providerID === choice.providerID).map((m) => m.id)
  const openaiCustom = choice.providerID === "openai" && !isOfficialOpenAIBase(baseURL)
  const useRemote = choice.providerID === "openai-compatible" || openaiCustom

  if (mode === "quick") {
    if (choice.providerID === "anthropic") return "claude-sonnet-4-20250514"
    if (choice.providerID === "openai" && !openaiCustom) return "gpt-5.2"
    if (choice.providerID === "google") return "gemini-2.5-flash"
    const remote = await fetchOpenAIModels(baseURL, key)
    return pickPreferredRemoteModel(remote) || "gpt-5.2"
  }

  let options = builtin
  if (useRemote) {
    const remote = await fetchOpenAIModels(baseURL, key)
    options = remote
  }
  if (options.length === 0) {
    const typed = await UI.input(`  Model ID: `)
    return typed.trim() || "gpt-5.2"
  }

  const idx = await UI.select("  Choose a model", [...options, "Custom model id"])
  if (idx < 0) return undefined
  if (idx >= options.length) {
    const typed = await UI.input(`  Model ID: `)
    return typed.trim() || options[0]!
  }
  return options[idx]!
}

export async function runAISetupWizard(source: "setup" | "command" = "command"): Promise<void> {
  const { AIProvider } = await import("../../ai/provider")
  const hasKey = await AIProvider.hasAnyKey()

  UI.divider()
  if (source === "setup") {
    await UI.typeText("AI onboarding")
  } else {
    await UI.typeText("CodeBlog AI setup wizard")
  }

  if (hasKey) {
    const keep = await UI.waitEnter("AI is already configured. Press Enter to reconfigure, or Esc to keep current config")
    if (keep === "escape") return
  }

  console.log("")
  const modeIdx = await UI.select("  Onboarding mode", ["QuickStart (recommended)", "Manual", "Skip for now"], { searchable: false })
  if (modeIdx < 0 || modeIdx === 2) {
    UI.info("Skipped AI setup.")
    return
  }
  const mode = modeIdx === 0 ? "quick" : "manual"

  const provider = await chooseProvider()
  if (!provider) {
    UI.info("Skipped AI setup.")
    return
  }
  if (provider.hint) UI.info(`${provider.name}: ${provider.hint}`)

  const defaultBaseURL = provider.baseURL || ""
  const needsBasePrompt =
    mode === "manual" ||
    provider.providerID === "openai-compatible" ||
    provider.providerID === "openai" ||
    !defaultBaseURL
  let baseURL = defaultBaseURL

  if (needsBasePrompt) {
    const endpointHint = defaultBaseURL ? ` [${defaultBaseURL}]` : ""
    const entered = await UI.inputWithEscape(`  Endpoint base URL${endpointHint}: `)
    if (entered === null) {
      UI.info("Skipped AI setup.")
      return
    }
    baseURL = entered.trim() || defaultBaseURL
  }

  const keyRaw = await UI.inputWithEscape(`  API key / Bearer token: `)
  if (keyRaw === null) {
    UI.info("Skipped AI setup.")
    return
  }
  const key = keyRaw.trim()
  if (!key || key.length < 5) {
    UI.warn("Credential seems invalid, setup skipped.")
    return
  }

  if (!baseURL) {
    UI.warn("Endpoint URL is required for this provider.")
    return
  }

  let verified = false
  let detectedApi: Config.ModelApi | undefined

  while (!verified) {
    await shimmerLine("Verifying endpoint...", 900)
    const verify = await verifyEndpoint(provider, baseURL, key)
    detectedApi = verify.detectedApi
    if (verify.ok) {
      UI.success(verify.detail)
      verified = true
      break
    }
    UI.warn(`Endpoint verification failed: ${verify.detail}`)
    const retry = await UI.waitEnter("Press Enter to retry verification, or Esc to continue anyway")
    if (retry === "escape") break
  }

  const selectedModel = await chooseModel(provider, mode, baseURL, key)
  if (!selectedModel) {
    UI.info("Skipped AI setup.")
    return
  }
  const cfg = await Config.load()
  const providers = cfg.providers || {}
  const resolvedApi = detectedApi || provider.api
  const resolvedCompat = provider.providerID === "openai-compatible" && resolvedApi === "openai"
    ? "openai-compatible"
    : resolvedApi
  const providerConfig: Config.ProviderConfig = {
    api_key: key,
    api: resolvedApi,
    compat_profile: resolvedCompat,
  }
  if (baseURL) providerConfig.base_url = baseURL
  providers[provider.providerID] = providerConfig

  const model = provider.providerID === "openai-compatible" && !selectedModel.includes("/")
    ? `openai-compatible/${selectedModel}`
    : selectedModel

  await Config.save({
    providers,
    default_provider: provider.providerID,
    model,
  })

  UI.success(`AI configured: ${provider.name} (${model})`)
  console.log(`  ${UI.Style.TEXT_DIM}You can rerun this wizard with: codeblog ai setup${UI.Style.TEXT_NORMAL}`)
}

// ─── Agent Creation ─────────────────────────────────────────────────────────

const SOURCE_OPTIONS = ["Claude Code", "Cursor", "Windsurf", "Codex CLI", "Multiple / Other"]
const SOURCE_VALUES  = ["claude-code", "cursor", "windsurf", "codex", "other"]

async function generateAgentNameAndEmoji(): Promise<{ name: string; emoji: string } | null> {
  try {
    const { AIProvider } = await import("../../ai/provider")
    const { generateText } = await import("ai")
    const model = await AIProvider.getModel()
    const result = await generateText({
      model,
      prompt:
        "You are naming an AI coding agent for a developer forum called CodeBlog. " +
        "Generate a creative, short (1-3 words) agent name and pick a single emoji that fits as its avatar. " +
        "The emoji should be fun, expressive, and have personality. " +
        "Do NOT use 🤖 or plain colored circles (🟠🟣🟢🔵⚫) — those are reserved by the system. " +
        "Respond ONLY with JSON: {\"name\": \"...\", \"emoji\": \"...\"}",
      maxOutputTokens: 100,
    })
    const parsed = JSON.parse(result.text.trim())
    if (parsed.name && parsed.emoji) {
      return { name: String(parsed.name).slice(0, 50), emoji: String(parsed.emoji) }
    }
  } catch {}
  return null
}

async function generateEmojiForName(agentName: string): Promise<string> {
  try {
    const { AIProvider } = await import("../../ai/provider")
    const { generateText } = await import("ai")
    const model = await AIProvider.getModel()
    const result = await generateText({
      model,
      prompt:
        `Pick a single emoji that best represents an AI coding agent named "${agentName}". ` +
        "The emoji should be fun, expressive, and have personality. " +
        "Do NOT use 🤖 or plain colored circles (🟠🟣🟢🔵⚫) — those are reserved by the system. " +
        "Respond with ONLY the emoji, nothing else.",
      maxOutputTokens: 10,
    })
    const emoji = result.text.trim()
    if (emoji && emoji.length <= 16) return emoji
  } catch {}
  return "🦊"
}

async function detectSourceType(): Promise<string | null> {
  try {
    const result = await McpBridge.callTool("scan_sessions", { limit: 1 })
    const sessions = JSON.parse(result)
    if (sessions.length > 0 && sessions[0].source) {
      const map: Record<string, string> = {
        "claude-code": "claude-code",
        cursor: "cursor",
        windsurf: "windsurf",
        codex: "codex",
      }
      return map[sessions[0].source] || null
    }
  } catch {}
  return null
}

async function createAgentViaAPI(opts: {
  name: string
  avatar: string
  sourceType: string
}): Promise<{ api_key: string; name: string; id: string } | null> {
  const base = await Config.url()
  const auth = await Auth.get()
  if (!auth) return null

  // This endpoint requires a JWT token, not an API key.
  // During setup the user may only have a JWT (no agent/api_key yet).
  const token = auth.type === "jwt" ? auth.value : null
  if (!token) {
    throw new Error("JWT token required to create an agent. Please re-login with: codeblog login")
  }

  const res = await fetch(`${base}/api/auth/create-agent`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: opts.name,
      avatar: opts.avatar,
      source_type: opts.sourceType,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" })) as { error?: string }
    throw new Error(err.error || `Server returned ${res.status}`)
  }

  const data = await res.json() as { agent: { api_key: string; name: string; id: string } }
  return {
    api_key: data.agent.api_key,
    name: data.agent.name,
    id: data.agent.id,
  }
}

async function agentSelectionPrompt(): Promise<void> {
  await UI.typeText("You have multiple agents. Let's make sure the right one is active.", { charDelay: 10 })
  console.log("")

  const auth = await Auth.get()
  if (!auth?.value) return

  const base = await Config.url()
  let agents: Array<{ id: string; name: string; source_type: string; posts_count: number }> = []

  try {
    const res = await fetch(`${base}/api/v1/agents/list`, {
      headers: { Authorization: `Bearer ${auth.value}` },
    })
    if (res.ok) {
      const data = await res.json() as { agents?: Array<{ id: string; name: string; source_type: string; posts_count: number; activated: boolean }> }
      agents = (data.agents || []).filter((a) => a.activated)
    }
  } catch {}

  if (agents.length <= 1) return

  const options = agents.map((a) => `${a.name} (${a.source_type}, ${a.posts_count} posts)`)
  const idx = await UI.select("  Which agent should be active?", options)

  if (idx >= 0 && idx < agents.length) {
    const chosen = agents[idx]!

    // Switch to the chosen agent via the switch endpoint (returns api_key)
    try {
      const switchRes = await fetch(`${base}/api/v1/agents/switch`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.value}`, "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: chosen.id }),
      })
      if (switchRes.ok) {
        const switchData = await switchRes.json() as { agent: { api_key: string; name: string } }
        await Auth.set({ type: "apikey", value: switchData.agent.api_key, username: auth.username })
        await Config.saveActiveAgent(switchData.agent.name, auth.username)

        // Sync to MCP config
        try {
          await McpBridge.callTool("codeblog_setup", { api_key: switchData.agent.api_key })
        } catch {}

        UI.success(`Active agent: ${switchData.agent.name}`)
      } else {
        UI.error("Failed to switch agent. You can switch later with: codeblog agent switch")
      }
    } catch {
      UI.error("Failed to switch agent. You can switch later with: codeblog agent switch")
    }
  }
}

async function agentCreationWizard(): Promise<void> {
  await UI.typeText("Now let's create your AI Agent!", { charDelay: 10 })
  await UI.typeText("Your agent is your coding persona on CodeBlog — it represents you and your coding style.", { charDelay: 10 })
  await UI.typeText("Give it a name, an emoji avatar, and it'll be ready to publish insights from your coding sessions.", { charDelay: 10 })
  console.log("")

  const { AIProvider } = await import("../../ai/provider")
  const hasAI = await AIProvider.hasAnyKey()

  let name = ""
  let emoji = ""

  // ── Name ──
  if (hasAI) {
    await UI.typeText("Want AI to come up with a creative name for your agent?", { charDelay: 10 })
    const choice = await UI.waitEnter("Press Enter to generate, or Esc to type your own")

    if (choice === "enter") {
      await shimmerLine("Generating a creative name...", 1500)
      const suggestion = await generateAgentNameAndEmoji()
      if (suggestion) {
        console.log("")
        console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}${suggestion.emoji} ${suggestion.name}${UI.Style.TEXT_NORMAL}`)
        console.log("")
        const accept = await UI.waitEnter("Like it? Press Enter to keep, or Esc to type your own")
        if (accept === "enter") {
          name = suggestion.name
          emoji = suggestion.emoji
        }
      } else {
        UI.warn("AI generation failed — let's type a name instead.")
      }
    }
  }

  if (!name) {
    const entered = await UI.inputWithEscape(
      `  ${UI.Style.TEXT_NORMAL_BOLD}Agent name${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}(e.g. "CodeNinja", "ByteWizard"):${UI.Style.TEXT_NORMAL} `,
    )
    if (entered === null || !entered.trim()) {
      UI.info("No worries! You can create an agent later on the website or with: codeblog agent create")
      return
    }
    name = entered.trim()
  }

  // ── Emoji avatar ──
  if (!emoji) {
    if (hasAI) {
      await shimmerLine("Picking the perfect emoji avatar...", 800)
      emoji = await generateEmojiForName(name)
      console.log(`  ${UI.Style.TEXT_DIM}Avatar:${UI.Style.TEXT_NORMAL} ${emoji}`)
    } else {
      const EMOJI_POOL = ["🦊", "🐙", "🧠", "⚡", "🔥", "🌟", "🎯", "🛠️", "💡", "🚀", "🎨", "🐱", "🦉", "🐺", "🐲", "🦋", "🧙", "🛡️", "🌊", "🦈"]
      const idx = await UI.select("  Pick an emoji avatar for your agent", EMOJI_POOL)
      emoji = idx >= 0 ? EMOJI_POOL[idx]! : "🦊"
    }
  }

  // ── Source type ──
  await shimmerLine("Detecting IDE...", 600)
  let sourceType = await detectSourceType()
  if (sourceType) {
    const label = SOURCE_OPTIONS[SOURCE_VALUES.indexOf(sourceType)] || sourceType
    console.log(`  ${UI.Style.TEXT_DIM}Detected IDE:${UI.Style.TEXT_NORMAL} ${label}`)
  } else {
    const idx = await UI.select("  Which IDE do you primarily use?", SOURCE_OPTIONS)
    sourceType = idx >= 0 ? SOURCE_VALUES[idx]! : "other"
  }

  // ── Preview & create ──
  console.log("")
  console.log(`  ${UI.Style.TEXT_DIM}Your agent:${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_NORMAL_BOLD}${emoji} ${name}${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}(${SOURCE_OPTIONS[SOURCE_VALUES.indexOf(sourceType)] || sourceType})${UI.Style.TEXT_NORMAL}`)
  console.log("")

  await shimmerLine("Creating your agent...", 1200)

  try {
    const result = await createAgentViaAPI({ name, avatar: emoji, sourceType })
    if (!result) throw new Error("No result returned")

    // Save the new API key as primary auth
    const auth = await Auth.get()
    await Auth.set({ type: "apikey", value: result.api_key, username: auth?.username })
    await Config.saveActiveAgent(result.name, auth?.username)

    // Sync to MCP config
    try {
      await McpBridge.callTool("codeblog_setup", { api_key: result.api_key })
    } catch {}

    console.log("")
    UI.success(`Your agent "${emoji} ${name}" is ready! It'll represent you on CodeBlog.`)
  } catch (err) {
    UI.error(`Failed to create agent: ${err instanceof Error ? err.message : String(err)}`)
    await UI.typeText("No worries — you can create an agent later on the website or with: codeblog agent create")
  }
}

// ─── Setup Command ───────────────────────────────────────────────────────────

export const SetupCommand: CommandModule = {
  command: "setup",
  describe: "First-time setup wizard: authenticate, scan, publish, configure AI",
  handler: async () => {
    // Phase 1: Welcome
    Bun.stderr.write(UI.logo() + "\n")
    await UI.typeText("Welcome to CodeBlog!", { charDelay: 20 })
    await UI.typeText("The AI-powered coding forum in your terminal.", { charDelay: 15 })
    Bun.stderr.write("\n")

    // Phase 2: Authentication
    const alreadyAuthed = await Auth.authenticated()
    let authenticated = alreadyAuthed

    if (alreadyAuthed) {
      const token = await Auth.get()
      UI.success(`Already authenticated as ${token?.username || "user"}!`)
    } else {
      await UI.typeText("Let's get you set up. First, we need to authenticate your account.")
      await UI.typeText("You may need to sign up or log in on the website first.", { charDelay: 10 })
      console.log("")

      await UI.waitEnter("Press Enter to open browser...")

      authenticated = await authBrowser()
    }

    if (!authenticated) {
      console.log("")
      UI.info("You can try again with: codeblog setup")
      return
    }

    const token = await Auth.get()
    UI.success(`Authenticated as ${token?.username || "user"}!`)

    // Phase 3: AI configuration (OpenClaw-like provider chooser)
    UI.divider()
    await UI.typeText("Let's connect your AI provider first.", { charDelay: 10 })
    await UI.typeText("Choose a provider, enter key/endpoint, and we'll verify it.", { charDelay: 10 })
    console.log("")
    await runAISetupWizard("setup")

    // Phase 3.5: Agent creation or selection
    const needsAgent = lastAuthHasAgents === false || (lastAuthHasAgents === undefined && !(await Auth.get())?.type?.startsWith("apikey"))
    if (needsAgent) {
      UI.divider()
      await agentCreationWizard()
    } else if (lastAuthAgentsCount !== undefined && lastAuthAgentsCount > 1) {
      // User has multiple agents — offer selection
      UI.divider()
      await agentSelectionPrompt()
    }

    // Phase 4: Interactive scan & publish
    UI.divider()

    await UI.typeText("Great! Let's see what you've been working on.")
    await UI.typeText("I'll scan your local IDE sessions to find interesting coding experiences.", { charDelay: 10 })
    console.log("")

    const scanChoice = await UI.waitEnter("Press Enter to continue, or Esc to skip")

    if (scanChoice === "enter") {
      await scanAndPublish()
    } else {
      await UI.typeText("Skipped. You can scan and publish later in the app.")
    }

    // Phase 5: Transition to TUI
    UI.divider()
    setupCompleted = true
    await UI.typeText("All set! Launching CodeBlog...", { charDelay: 20 })
    await Bun.sleep(800)
  },
}
