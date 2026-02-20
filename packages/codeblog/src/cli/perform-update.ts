import path from "path"
import { tmpdir } from "os"
import { mkdir, writeFile, rm, unlink, copyFile, chmod } from "fs/promises"

/**
 * Downloads and installs a specific version of the codeblog CLI binary.
 * Shared between the `update` command and auto-update logic.
 *
 * Throws on failure so callers can handle errors as they see fit.
 */
export async function performUpdate(latest: string): Promise<void> {
  const os = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "darwin" : "linux"
  const arch = process.arch === "arm64" ? "arm64" : "x64"
  const platform = `${os}-${arch}`
  const pkgName = `codeblog-app-${platform}`
  const url = `https://registry.npmjs.org/${pkgName}/-/${pkgName}-${latest}.tgz`

  const tmp = path.join(tmpdir(), `codeblog-update-${Date.now()}`)
  await mkdir(tmp, { recursive: true })

  try {
    // Download
    const tgz = path.join(tmp, "pkg.tgz")
    const dlController = new AbortController()
    const dlTimeout = setTimeout(() => dlController.abort(), 60_000)
    let dlRes: Response
    try {
      dlRes = await fetch(url, { signal: dlController.signal })
    } catch (e: any) {
      clearTimeout(dlTimeout)
      if (e.name === "AbortError") throw new Error("Download timed out (60s)")
      throw new Error(`Download failed: ${e.message}`)
    }
    clearTimeout(dlTimeout)
    if (!dlRes.ok) throw new Error(`Failed to download update for ${platform} (HTTP ${dlRes.status})`)

    const arrayBuf = await dlRes.arrayBuffer()
    await writeFile(tgz, Buffer.from(arrayBuf))

    // Extract
    const proc = Bun.spawn(["tar", "-xzf", tgz, "-C", tmp], { stdout: "ignore", stderr: "ignore" })
    await proc.exited

    // Install
    const bin = process.execPath
    const ext = os === "windows" ? ".exe" : ""
    const src = path.join(tmp, "package", "bin", `codeblog${ext}`)

    if (os !== "windows") {
      try { await unlink(bin) } catch {}
    }
    await copyFile(src, bin)
    if (os !== "windows") {
      await chmod(bin, 0o755)
    }

    // macOS codesign
    if (os === "darwin") {
      await Bun.spawn(["codesign", "--remove-signature", bin], { stdout: "ignore", stderr: "ignore" }).exited
      const cs = Bun.spawn(["codesign", "--sign", "-", "--force", bin], { stdout: "ignore", stderr: "ignore" })
      if ((await cs.exited) !== 0) throw new Error("macOS code signing failed")
      const verify = Bun.spawn(["codesign", "--verify", "--deep", "--strict", bin], { stdout: "ignore", stderr: "ignore" })
      if ((await verify.exited) !== 0) throw new Error("macOS signature verification failed")
    }
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {})
  }
}
