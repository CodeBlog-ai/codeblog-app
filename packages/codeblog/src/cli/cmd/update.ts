import type { CommandModule } from "yargs"
import { UI } from "../ui"
import { performUpdate } from "../perform-update"

export const UpdateCommand: CommandModule = {
  command: "update",
  describe: "Update codeblog CLI to the latest version",
  builder: (yargs) =>
    yargs.option("force", {
      describe: "Force update even if already on latest",
      type: "boolean",
      default: false,
    }),
  handler: async (args) => {
    Bun.stderr.write(UI.logo() + "\n")

    const pkg = await import("../../../package.json")
    const current = pkg.version

    UI.info(`Current version: ${UI.Style.TEXT_NORMAL_BOLD}v${current}${UI.Style.TEXT_NORMAL}`)
    UI.info("Checking for updates...")

    const checkController = new AbortController()
    const checkTimeout = setTimeout(() => checkController.abort(), 10_000)
    let res: Response
    try {
      res = await fetch("https://registry.npmjs.org/codeblog-app/latest", { signal: checkController.signal })
    } catch (e: any) {
      clearTimeout(checkTimeout)
      if (e.name === "AbortError") {
        UI.error("Version check timed out (10s). Please check your network and try again.")
      } else {
        UI.error(`Failed to check for updates: ${e.message}`)
      }
      process.exitCode = 1
      return
    }
    clearTimeout(checkTimeout)
    if (!res.ok) {
      UI.error("Failed to check for updates")
      process.exitCode = 1
      return
    }

    const data = await res.json() as { version: string }
    const latest = data.version

    if (current === latest && !args.force) {
      UI.success(`Already on latest version ${UI.Style.TEXT_NORMAL_BOLD}v${current}${UI.Style.TEXT_NORMAL}`)
      console.log("")
      await promptLaunch()
      return
    }

    UI.info(`Updating ${UI.Style.TEXT_DIM}v${current}${UI.Style.TEXT_NORMAL} → ${UI.Style.TEXT_NORMAL_BOLD}v${latest}${UI.Style.TEXT_NORMAL}...`)

    try {
      await performUpdate(latest)
      console.log("")
      UI.success(`Updated to ${UI.Style.TEXT_NORMAL_BOLD}v${latest}${UI.Style.TEXT_NORMAL}!`)
      console.log("")
      await promptLaunch()
    } catch (e) {
      UI.error(e instanceof Error ? e.message : String(e))
      process.exitCode = 1
    }
  },
}

async function promptLaunch() {
  if (!process.stdin.isTTY) return

  const key = await UI.waitEnter("Press Enter to launch codeblog (or Esc to exit)")
  if (key === "escape") return

  // Re-launch without subcommand args so it enters TUI.
  // In compiled binary: process.argv = ["/path/to/codeblog", "update"]
  // In dev mode:        process.argv = ["bun", "src/index.ts", "update"]
  // We strip everything after the entry script to drop "update".
  const entry = process.argv.findIndex((a) => a.endsWith("index.ts") || a.endsWith("index.js"))
  const cmd = entry >= 0
    ? process.argv.slice(0, entry + 1)
    : [process.argv[0]!]

  const proc = Bun.spawn(cmd, {
    stdio: ["inherit", "inherit", "inherit"],
  })
  const code = await proc.exited
  process.exit(code)
}
