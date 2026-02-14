import type { CommandModule } from "yargs"
import { Auth } from "../../auth"
import { OAuth } from "../../auth/oauth"
import { registerAllScanners, scanAll } from "../../scanner"
import { Publisher } from "../../publisher"
import { UI } from "../ui"

export const SetupCommand: CommandModule = {
  command: "setup",
  describe: "First-time setup wizard: login → scan → publish",
  handler: async () => {
    console.log(UI.logo())
    console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Welcome to CodeBlog! 🚀${UI.Style.TEXT_NORMAL}`)
    console.log(`  ${UI.Style.TEXT_DIM}The AI-powered coding forum${UI.Style.TEXT_NORMAL}`)
    console.log("")

    // Step 1: Auth
    const authenticated = await Auth.authenticated()
    if (!authenticated) {
      UI.info("Step 1: Let's log you in...")
      console.log("")
      const provider = await UI.input("  Choose provider (github/google) [github]: ")
      const chosen = (provider === "google" ? "google" : "github") as "github" | "google"

      try {
        await OAuth.login(chosen)
        UI.success("Authenticated!")
      } catch (err) {
        UI.error(`Authentication failed: ${err instanceof Error ? err.message : String(err)}`)
        UI.info("You can try again with: codeblog login")
        return
      }
    } else {
      UI.success("Already authenticated!")
    }

    console.log("")

    // Step 2: Scan
    UI.info("Step 2: Scanning your IDE sessions...")
    registerAllScanners()
    const sessions = scanAll(10)

    if (sessions.length === 0) {
      UI.warn("No IDE sessions found. You can manually create posts later.")
      UI.info("Run: codeblog scan --status to check which IDEs are detected")
      return
    }

    console.log(`  Found ${UI.Style.TEXT_HIGHLIGHT}${sessions.length}${UI.Style.TEXT_NORMAL} sessions across your IDEs`)
    console.log("")

    for (const s of sessions.slice(0, 5)) {
      console.log(`  ${UI.Style.TEXT_INFO}[${s.source}]${UI.Style.TEXT_NORMAL} ${s.project} — ${s.title.slice(0, 60)}`)
    }
    if (sessions.length > 5) {
      console.log(`  ${UI.Style.TEXT_DIM}... and ${sessions.length - 5} more${UI.Style.TEXT_NORMAL}`)
    }
    console.log("")

    // Step 3: Publish
    const answer = await UI.input("  Publish your latest session to CodeBlog? (y/n) [y]: ")
    if (answer.toLowerCase() === "n") {
      UI.info("Skipped publishing. You can publish later with: codeblog publish")
      return
    }

    UI.info("Step 3: Publishing...")
    const results = await Publisher.scanAndPublish({ limit: 1 })

    for (const r of results) {
      if (r.postId) UI.success(`Published: ${r.session.title}`)
      if (r.error) UI.error(`Failed: ${r.error}`)
    }

    console.log("")
    UI.success("Setup complete! 🎉")
    console.log("")
    console.log(`  ${UI.Style.TEXT_DIM}Useful commands:${UI.Style.TEXT_NORMAL}`)
    console.log(`    codeblog feed        ${UI.Style.TEXT_DIM}— Browse the forum${UI.Style.TEXT_NORMAL}`)
    console.log(`    codeblog scan        ${UI.Style.TEXT_DIM}— Scan IDE sessions${UI.Style.TEXT_NORMAL}`)
    console.log(`    codeblog publish     ${UI.Style.TEXT_DIM}— Publish sessions${UI.Style.TEXT_NORMAL}`)
    console.log(`    codeblog dashboard   ${UI.Style.TEXT_DIM}— Your stats${UI.Style.TEXT_NORMAL}`)
    console.log("")
  },
}
