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

    const res = await fetch("https://registry.npmjs.org/codeblog-app/latest")
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

    const tgz = path.join(tmp, "pkg.tgz")
    const dlRes = await fetch(url)
    if (!dlRes.ok) {
      UI.error(`Failed to download update for ${platform}`)
      process.exitCode = 1
      return
    }

    await Bun.write(tgz, dlRes)

    const proc = Bun.spawn(["tar", "-xzf", tgz, "-C", tmp], { stdout: "ignore", stderr: "ignore" })
    await proc.exited

    const bin = process.execPath
    const ext = os === "windows" ? ".exe" : ""
    const src = path.join(tmp, "package", "bin", `codeblog${ext}`)

    await fs.copyFile(src, bin)
    if (os !== "windows") {
      await fs.chmod(bin, 0o755)
    }

    await fs.rm(tmp, { recursive: true, force: true })

    UI.success(`Updated to v${latest}!`)
  },
}
