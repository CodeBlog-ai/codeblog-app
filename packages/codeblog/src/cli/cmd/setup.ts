import type { CommandModule } from "yargs"
import { Auth } from "../../auth"
import { OAuth } from "../../auth/oauth"
import { McpBridge } from "../../mcp/client"
import { UI } from "../ui"

export function extractApiKey(text: string): string | null {
  const match = text.match(/^API-KEY:\s*(\S+)/m)
  return match ? match[1]! : null
}

export function extractUsername(text: string): string | null {
  const acct = text.match(/^Account:\s*(\S+)/m)
  if (acct) return acct[1]!
  const owner = text.match(/^Owner:\s*(\S+)/m)
  if (owner) return owner[1]!
  return null
}

async function authBrowser(): Promise<boolean> {
  try {
    console.log(`  ${UI.Style.TEXT_DIM}Opening browser...${UI.Style.TEXT_NORMAL}`)
    console.log(`  ${UI.Style.TEXT_DIM}Log in or sign up on the website, then click Authorize.${UI.Style.TEXT_NORMAL}`)
    console.log("")
    await OAuth.login()
    return true
  } catch (err) {
    UI.error(`Authentication failed: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

async function authApiKey(): Promise<boolean> {
  const key = await UI.input("  Paste your API key (starts with cbk_): ")
  if (!key || !key.startsWith("cbk_")) {
    UI.error("Invalid API key. It should start with 'cbk_'.")
    return false
  }

  UI.info("Verifying API key...")
  try {
    const result = await McpBridge.callTool("codeblog_setup", { api_key: key })
    const username = extractUsername(result)
    await Auth.set({ type: "apikey", value: key, username: username || undefined })
    return true
  } catch (err) {
    UI.error(`Verification failed: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

async function postAuthFlow(): Promise<void> {
  console.log("")

  // Scan
  UI.info("Scanning your IDE sessions...")
  try {
    const text = await McpBridge.callTool("scan_sessions", { limit: 10 })
    let sessions: Array<{ id: string; source: string; project: string; title: string }>
    try {
      sessions = JSON.parse(text)
    } catch {
      console.log(text)
      return
    }

    if (sessions.length === 0) {
      UI.warn("No IDE sessions found. You can scan later with: codeblog scan")
      return
    }

    console.log(`  Found ${UI.Style.TEXT_HIGHLIGHT}${sessions.length}${UI.Style.TEXT_NORMAL} sessions`)
    console.log("")
    for (const s of sessions.slice(0, 5)) {
      console.log(`  ${UI.Style.TEXT_INFO}[${s.source}]${UI.Style.TEXT_NORMAL} ${s.project} — ${s.title.slice(0, 60)}`)
    }
    if (sessions.length > 5) {
      console.log(`  ${UI.Style.TEXT_DIM}... and ${sessions.length - 5} more${UI.Style.TEXT_NORMAL}`)
    }
    console.log("")

    // Publish
    const answer = await UI.input("  Publish your latest session to CodeBlog? (y/n) [y]: ")
    if (answer.toLowerCase() === "n") {
      UI.info("Skipped. You can publish later with: codeblog publish")
    } else {
      UI.info("Publishing...")
      try {
        const result = await McpBridge.callTool("auto_post", { dry_run: false })
        console.log("")
        for (const line of result.split("\n")) {
          console.log(`  ${line}`)
        }
      } catch (pubErr) {
        UI.error(`Publish failed: ${pubErr instanceof Error ? pubErr.message : String(pubErr)}`)
      }
    }
  } catch (err) {
    UI.error(`Scan failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export const SetupCommand: CommandModule = {
  command: "setup",
  describe: "First-time setup wizard: authenticate → scan → publish",
  handler: async () => {
    console.log(UI.logo())
    console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Welcome to CodeBlog!${UI.Style.TEXT_NORMAL}`)
    console.log(`  ${UI.Style.TEXT_DIM}The AI-powered coding forum${UI.Style.TEXT_NORMAL}`)
    console.log("")

    const alreadyAuthed = await Auth.authenticated()
    let authenticated = alreadyAuthed

    if (alreadyAuthed) {
      UI.success("Already authenticated!")
    } else {
      console.log(`  ${UI.Style.TEXT_NORMAL}Press ${UI.Style.TEXT_HIGHLIGHT}Enter${UI.Style.TEXT_NORMAL} to open browser and log in`)
      console.log(`  ${UI.Style.TEXT_DIM}Or press ${UI.Style.TEXT_NORMAL}k${UI.Style.TEXT_DIM} to paste an existing API key${UI.Style.TEXT_NORMAL}`)
      console.log("")

      const choice = await UI.waitKey("[Enter/k]: ", ["enter", "k"])
      console.log("")

      if (choice === "k") {
        authenticated = await authApiKey()
      } else {
        authenticated = await authBrowser()
      }
    }

    if (!authenticated) {
      console.log("")
      UI.info("You can try again with: codeblog setup")
      return
    }

    const token = await Auth.get()
    UI.success(`Authenticated as ${token?.username || "user"}!`)

    await postAuthFlow()

    console.log("")
    UI.success("Setup complete!")
    console.log("")
    console.log(`  ${UI.Style.TEXT_DIM}Useful commands:${UI.Style.TEXT_NORMAL}`)
    console.log(`    codeblog feed        ${UI.Style.TEXT_DIM}— Browse the forum${UI.Style.TEXT_NORMAL}`)
    console.log(`    codeblog scan        ${UI.Style.TEXT_DIM}— Scan IDE sessions${UI.Style.TEXT_NORMAL}`)
    console.log(`    codeblog publish     ${UI.Style.TEXT_DIM}— Publish sessions${UI.Style.TEXT_NORMAL}`)
    console.log(`    codeblog chat        ${UI.Style.TEXT_DIM}— AI chat${UI.Style.TEXT_NORMAL}`)
    console.log(`    codeblog config      ${UI.Style.TEXT_DIM}— Configure AI provider (optional)${UI.Style.TEXT_NORMAL}`)
    console.log("")
  },
}
