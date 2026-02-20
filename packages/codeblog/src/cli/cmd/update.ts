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
    const pkg = await import("../../../package.json")
    const current = pkg.version

    UI.info(`Current version: v${current}`)
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
      UI.success(`Already on latest version v${current}`)
      return
    }

    UI.info(`Updating v${current} → v${latest}...`)

    try {
      await performUpdate(latest)
      UI.success(`Updated to v${latest}!`)
    } catch (e) {
      UI.error(e instanceof Error ? e.message : String(e))
      process.exitCode = 1
    }
  },
}
