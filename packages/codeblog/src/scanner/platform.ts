import * as fs from "fs"
import * as os from "os"
import * as path from "path"

export type Platform = "macos" | "windows" | "linux"

export function getPlatform(): Platform {
  switch (os.platform()) {
    case "win32":
      return "windows"
    case "darwin":
      return "macos"
    default:
      return "linux"
  }
}

export function getHome(): string {
  return os.homedir()
}

export function getAppDataDir(): string {
  const platform = getPlatform()
  if (platform === "windows") return process.env.APPDATA || path.join(getHome(), "AppData", "Roaming")
  if (platform === "macos") return path.join(getHome(), "Library", "Application Support")
  return process.env.XDG_CONFIG_HOME || path.join(getHome(), ".config")
}

export function getLocalAppDataDir(): string {
  const platform = getPlatform()
  if (platform === "windows") return process.env.LOCALAPPDATA || path.join(getHome(), "AppData", "Local")
  if (platform === "macos") return path.join(getHome(), "Library", "Application Support")
  return process.env.XDG_DATA_HOME || path.join(getHome(), ".local", "share")
}

export function resolvePaths(candidates: string[]): string[] {
  return candidates.filter((p) => {
    try {
      return fs.existsSync(p)
    } catch {
      return false
    }
  })
}
