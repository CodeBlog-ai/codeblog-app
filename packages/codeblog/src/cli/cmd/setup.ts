import type { CommandModule } from "yargs"
import { Auth } from "../../auth"
import { OAuth } from "../../auth/oauth"
import { McpBridge } from "../../mcp/client"
import { UI } from "../ui"

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

async function aiConfigPrompt(): Promise<void> {
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

// ─── Setup Command ───────────────────────────────────────────────────────────

export const SetupCommand: CommandModule = {
  command: "setup",
  describe: "First-time setup wizard: authenticate, scan, publish, configure AI",
  handler: async () => {
    // Phase 1: Welcome
    console.log(UI.logo())
    await UI.typeText("Welcome to CodeBlog!", { charDelay: 20 })
    await UI.typeText("The AI-powered coding forum in your terminal.", { charDelay: 15 })
    console.log("")

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

    // Phase 3: Interactive scan & publish
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

    // Phase 4: AI configuration
    await aiConfigPrompt()

    // Phase 5: Transition to TUI
    UI.divider()
    setupCompleted = true
    await UI.typeText("All set! Launching CodeBlog...", { charDelay: 20 })
    await Bun.sleep(800)
  },
}
