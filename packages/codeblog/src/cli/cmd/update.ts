import type { CommandModule } from "yargs"
import { UI } from "../ui"

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

    const os = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "darwin" : "linux"
    const arch = process.arch === "arm64" ? "arm64" : "x64"
    const platform = `${os}-${arch}`
    const pkg_name = `codeblog-app-${platform}`
    const url = `https://registry.npmjs.org/${pkg_name}/-/${pkg_name}-${latest}.tgz`

    const tmpdir = (await import("os")).tmpdir()
    const path = await import("path")
    const fs = await import("fs/promises")
    const tmp = path.join(tmpdir, `codeblog-update-${Date.now()}`)
    await fs.mkdir(tmp, { recursive: true })

    UI.info("Downloading...")
    const tgz = path.join(tmp, "pkg.tgz")
    const dlController = new AbortController()
    const dlTimeout = setTimeout(() => dlController.abort(), 60_000)
    let dlRes: Response
    try {
      dlRes = await fetch(url, { signal: dlController.signal })
    } catch (e: any) {
      clearTimeout(dlTimeout)
      await fs.rm(tmp, { recursive: true, force: true }).catch(() => {})
      if (e.name === "AbortError") {
        UI.error("Download timed out (60s). Please check your network and try again.")
      } else {
        UI.error(`Download failed: ${e.message}`)
      }
      process.exitCode = 1
      return
    }
    clearTimeout(dlTimeout)
    if (!dlRes.ok) {
      UI.error(`Failed to download update for ${platform} (HTTP ${dlRes.status})`)
      await fs.rm(tmp, { recursive: true, force: true }).catch(() => {})
      process.exitCode = 1
      return
    }

    const arrayBuf = await dlRes.arrayBuffer()
    await fs.writeFile(tgz, Buffer.from(arrayBuf))

    UI.info("Extracting...")
    const proc = Bun.spawn(["tar", "-xzf", tgz, "-C", tmp], { stdout: "ignore", stderr: "ignore" })
    await proc.exited

    const bin = process.execPath
    const ext = os === "windows" ? ".exe" : ""
    const src = path.join(tmp, "package", "bin", `codeblog${ext}`)

    UI.info("Installing...")
    // On macOS/Linux, remove the running binary first to avoid ETXTBSY
    if (os !== "windows") {
      try {
        await fs.unlink(bin)
      } catch {
        // ignore if removal fails
      }
    }
    await fs.copyFile(src, bin)
    if (os !== "windows") {
      await fs.chmod(bin, 0o755)
    }
    if (os === "darwin") {
      await Bun.spawn(["codesign", "--remove-signature", bin], { stdout: "ignore", stderr: "ignore" }).exited
      const cs = Bun.spawn(["codesign", "--sign", "-", "--force", bin], { stdout: "ignore", stderr: "ignore" })
      if ((await cs.exited) !== 0) {
        await fs.rm(tmp, { recursive: true, force: true })
        UI.error("Update installed but macOS code signing failed. Please reinstall with install.sh.")
        process.exitCode = 1
        return
      }
      const verify = Bun.spawn(["codesign", "--verify", "--deep", "--strict", bin], {
        stdout: "ignore",
        stderr: "ignore",
      })
      if ((await verify.exited) !== 0) {
        await fs.rm(tmp, { recursive: true, force: true })
        UI.error("Update installed but signature verification failed. Please reinstall with install.sh.")
        process.exitCode = 1
        return
      }
    }

    await fs.rm(tmp, { recursive: true, force: true })

    UI.success(`Updated to v${latest}!`)
  },
}
