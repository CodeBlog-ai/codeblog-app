import type { CommandModule } from "yargs"
import { UI } from "../ui"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const NODE_LIKE = new Set(["node", "node.exe", "bun", "bun.exe", "bunx", "bunx.exe"])

function platformInfo() {
  const os = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "darwin" : "linux"
  const arch = process.arch === "arm64" ? "arm64" : "x64"
  const binary = os === "windows" ? "codeblog.exe" : "codeblog"
  return {
    os,
    arch,
    binary,
    platform: `${os}-${arch}`,
    packageName: `codeblog-app-${os}-${arch}`,
  }
}

function findInstalledBinary(startDir: string, packageName: string, binary: string): string | undefined {
  let current = startDir
  for (;;) {
    const candidate = path.join(current, "node_modules", packageName, "bin", binary)
    if (fs.existsSync(candidate)) return candidate
    const parent = path.dirname(current)
    if (parent === current) return undefined
    current = parent
  }
}

function resolveUpdateTarget(packageName: string, binary: string): string {
  const exec = process.execPath
  const name = path.basename(exec).toLowerCase()
  if (!NODE_LIKE.has(name)) return exec

  const fromArgv = process.argv[1]
  if (fromArgv) {
    const start = path.dirname(fs.realpathSync(fromArgv))
    const candidate = findInstalledBinary(start, packageName, binary)
    if (candidate) return candidate
  }

  const here = path.dirname(fileURLToPath(import.meta.url))
  const fallback = findInstalledBinary(here, packageName, binary)
  if (fallback) return fallback

  throw new Error(
    "Could not find installed CodeBlog binary safely. Reinstall with install.sh / install.ps1 or npm install -g codeblog-app.",
  )
}

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

    const info = platformInfo()
    const url = `https://registry.npmjs.org/${info.packageName}/-/${info.packageName}-${latest}.tgz`

    const tmpdir = (await import("os")).tmpdir()
    const fsp = await import("fs/promises")
    const tmp = path.join(tmpdir, `codeblog-update-${Date.now()}`)
    await fsp.mkdir(tmp, { recursive: true })
    const cleanup = () => fsp.rm(tmp, { recursive: true, force: true })

    const tgz = path.join(tmp, "pkg.tgz")
    const dlRes = await fetch(url)
    if (!dlRes.ok) {
      await cleanup()
      UI.error(`Failed to download update for ${info.platform}`)
      process.exitCode = 1
      return
    }

    const archive = Buffer.from(await dlRes.arrayBuffer())
    await fsp.writeFile(tgz, archive)

    const proc = Bun.spawn(["tar", "-xzf", tgz, "-C", tmp], { stdout: "ignore", stderr: "ignore" })
    const untarExit = await proc.exited
    if (untarExit !== 0) {
      await cleanup()
      UI.error("Failed to extract update package")
      process.exitCode = 1
      return
    }

    const source = path.join(tmp, "package", "bin", info.binary)
    if (!fs.existsSync(source)) {
      await cleanup()
      UI.error(`Downloaded package is missing binary: ${source}`)
      process.exitCode = 1
      return
    }
    const target = resolveUpdateTarget(info.packageName, info.binary)

    await fsp.copyFile(source, target)
    if (info.os !== "windows") {
      await fsp.chmod(target, 0o755)
    }
    if (info.os === "darwin") {
      const sign = Bun.spawn(["codesign", "--sign", "-", "--force", target], { stdout: "ignore", stderr: "ignore" })
      const signExit = await Promise.race([
        sign.exited,
        new Promise<number>((resolve) => setTimeout(() => resolve(-1), 5000)),
      ])
      if (signExit === -1) {
        sign.kill()
        UI.warn("codesign timed out; continuing with unsigned binary")
      }
    }

    await cleanup()

    UI.success(`Updated to v${latest}!`)
    UI.info(`Updated binary: ${target}`)
  },
}
