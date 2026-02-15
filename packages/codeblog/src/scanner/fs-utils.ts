import * as fs from "fs"
import * as path from "path"

export function safeReadFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8")
  } catch {
    return null
  }
}

export function safeReadJson<T = unknown>(filePath: string): T | null {
  const content = safeReadFile(filePath)
  if (!content) return null
  try {
    return JSON.parse(content) as T
  } catch {
    return null
  }
}

export function safeStats(filePath: string): fs.Stats | null {
  try {
    return fs.statSync(filePath)
  } catch {
    return null
  }
}

export function listFiles(dir: string, extensions?: string[], recursive = false): string[] {
  if (!fs.existsSync(dir)) return []
  const results: string[] = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isFile()) {
        if (!extensions || extensions.some((ext) => entry.name.endsWith(ext))) results.push(fullPath)
      } else if (entry.isDirectory() && recursive) {
        results.push(...listFiles(fullPath, extensions, true))
      }
    }
  } catch {
    // Permission denied or other errors
  }
  return results
}

export function listDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.join(dir, e.name))
  } catch {
    return []
  }
}

export function exists(p: string): boolean {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

export function extractProjectDescription(projectPath: string): string | null {
  if (!projectPath || !fs.existsSync(projectPath)) return null

  const pkgPath = path.join(projectPath, "package.json")
  const pkg = safeReadJson<{ name?: string; description?: string }>(pkgPath)
  if (pkg?.description) return pkg.description.slice(0, 200)

  for (const readmeName of ["README.md", "readme.md", "Readme.md", "README.rst"]) {
    const readmePath = path.join(projectPath, readmeName)
    const content = safeReadFile(readmePath)
    if (!content) continue
    const lines = content.split("\n")
    let desc = ""
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        if (desc) break
        continue
      }
      if (trimmed.startsWith("#") || trimmed.startsWith("=") || trimmed.startsWith("-")) {
        if (desc) break
        continue
      }
      if (trimmed.startsWith("![") || trimmed.startsWith("<img")) continue
      desc += (desc ? " " : "") + trimmed
      if (desc.length > 200) break
    }
    if (desc.length > 10) return desc.slice(0, 300)
  }

  const cargoPath = path.join(projectPath, "Cargo.toml")
  const cargo = safeReadFile(cargoPath)
  if (cargo) {
    const match = cargo.match(/description\s*=\s*"([^"]+)"/)
    const desc = match?.[1]
    if (desc) return desc.slice(0, 200)
  }

  return null
}

export function readJsonl<T = unknown>(filePath: string): T[] {
  const content = safeReadFile(filePath)
  if (!content) return []
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as T
      } catch {
        return null
      }
    })
    .filter((x): x is T => x !== null)
}
