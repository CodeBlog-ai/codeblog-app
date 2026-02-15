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

async function scanAndPublish(): Promise<void> {
  // Scan
  await UI.typeText("Scanning your local IDE sessions...", { charDelay: 15 })
  console.log("")

  let sessions: Array<{ id: string; source: string; project: string; title: string }>
  try {
    const text = await McpBridge.callTool("scan_sessions", { limit: 10 })
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

  await UI.typeText("Let me analyze your most interesting session and create a blog post...")
  console.log("")

  // Dry run — preview
  let preview: string
  try {
    preview = await McpBridge.callTool("auto_post", { dry_run: true })
  } catch (err) {
    UI.warn(`Could not generate post: ${err instanceof Error ? err.message : String(err)}`)
    await UI.typeText("You can try again later with /publish in the app.")
    return
  }

  // Display preview
  const cleaned = UI.cleanMarkdown(preview)
  UI.divider()

  // Extract and display title/tags nicely
  const lines = cleaned.split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      console.log("")
      continue
    }
    if (trimmed.startsWith("DRY RUN")) continue
    if (trimmed.startsWith("Title:")) {
      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}${trimmed}${UI.Style.TEXT_NORMAL}`)
    } else if (trimmed.startsWith("Tags:") || trimmed.startsWith("Category:") || trimmed.startsWith("Session:")) {
      console.log(`  ${UI.Style.TEXT_DIM}${trimmed}${UI.Style.TEXT_NORMAL}`)
    } else if (trimmed === "---" || trimmed.match(/^─+$/)) {
      // skip dividers in content
    } else {
      console.log(`  ${trimmed}`)
    }
  }

  UI.divider()

  // Confirm publish
  console.log(`  ${UI.Style.TEXT_DIM}Press Enter to publish this post, or Esc to skip${UI.Style.TEXT_NORMAL}`)
  const choice = await UI.waitEnter()

  if (choice === "escape") {
    await UI.typeText("Skipped. You can publish later with /publish in the app.")
    return
  }

  // Publish
  await UI.typeText("Publishing...", { charDelay: 20 })
  try {
    const result = await McpBridge.callTool("auto_post", { dry_run: false })
    console.log("")

    // Extract URL from result
    const urlMatch = result.match(/(?:URL|View at|view at)[:\s]*(https?:\/\/\S+)/i)
    if (urlMatch) {
      UI.success(`Published! View at: ${urlMatch[1]}`)
    } else {
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

  console.log(`  ${UI.Style.TEXT_DIM}Press Enter to configure AI, or Esc to skip${UI.Style.TEXT_NORMAL}`)
  const choice = await UI.waitEnter()

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

  // AI config flow: URL → Key (reuses saveProvider from ai/configure.ts)
  console.log("")
  const url = await UI.input(`  ${UI.Style.TEXT_NORMAL_BOLD}API URL${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}(or press Enter to skip):${UI.Style.TEXT_NORMAL} `)
  const key = await UI.input(`  ${UI.Style.TEXT_NORMAL_BOLD}API Key:${UI.Style.TEXT_NORMAL} `)

  if (!key || key.length < 5) {
    UI.warn("API key too short, skipping AI configuration.")
    await UI.typeText("You can configure AI later with /ai in the app.")
    return
  }

  try {
    const { saveProvider } = await import("../../ai/configure")
    console.log(`  ${UI.Style.TEXT_DIM}Detecting API format...${UI.Style.TEXT_NORMAL}`)
    const result = await saveProvider(url.trim(), key.trim())
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

      console.log(`  ${UI.Style.TEXT_DIM}Press Enter to open browser...${UI.Style.TEXT_NORMAL}`)
      await UI.waitEnter()

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

    console.log(`  ${UI.Style.TEXT_DIM}Press Enter to continue...${UI.Style.TEXT_NORMAL}`)
    const scanChoice = await UI.waitEnter()

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
