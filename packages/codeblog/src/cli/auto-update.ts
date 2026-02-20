import { performUpdate } from "./perform-update"
import { UI } from "./ui"

/**
 * Checks for a newer CLI version on startup and auto-updates if available.
 * Equivalent to running `codeblog update` automatically.
 * On any failure, silently continues — never blocks normal usage.
 */
export async function checkAndAutoUpdate(): Promise<void> {
  try {
    // Skip if disabled via env
    if (process.env.CODEBLOG_NO_AUTO_UPDATE === "1") return

    // Skip if running the `update` command (avoid double-update)
    const cmd = process.argv[2]
    if (cmd === "update") return

    // Fetch latest version from npm registry
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    let res: Response
    try {
      res = await fetch("https://registry.npmjs.org/codeblog-app/latest", { signal: controller.signal })
    } catch (e: any) {
      clearTimeout(timeout)
      if (e.name === "AbortError") {
        UI.error("Version check timed out (10s). Please check your network and try again.")
      } else {
        UI.error(`Failed to check for updates: ${e.message}`)
      }
      return
    }
    clearTimeout(timeout)
    if (!res.ok) return

    const data = (await res.json()) as { version: string }
    const latest = data.version
    const pkg = await import("../../package.json")
    const current = pkg.version

    if (current === latest) return

    // Run the same flow as `codeblog update`
    UI.info(`Current version: v${current}`)
    UI.info(`Updating v${current} → v${latest}...`)

    await performUpdate(latest)
    UI.success(`Updated to v${latest}!`)

    // Re-exec: run the updated binary with the same arguments
    const proc = Bun.spawn([process.execPath, ...process.argv.slice(1)], {
      stdio: ["inherit", "inherit", "inherit"],
    })
    const code = await proc.exited
    process.exit(code)
  } catch (e) {
    UI.error(e instanceof Error ? e.message : String(e))
  }
}
