import * as fs from "fs"
import * as path from "path"
import { UI } from "./ui"

const home = process.env.HOME || process.env.USERPROFILE || "~"

interface IdeTarget {
  name: string
  id: string
  configPath: string
  detect: () => boolean
  read: () => Record<string, unknown>
  write: (config: Record<string, unknown>) => void
}

const MCP_SERVER_ENTRY = {
  command: "npx",
  args: ["-y", "codeblog-mcp@latest"],
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function readJson(filePath: string): Record<string, unknown> {
  try {
    if (!fs.existsSync(filePath)) return {}
    const raw = fs.readFileSync(filePath, "utf-8").trim()
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function writeJson(filePath: string, data: Record<string, unknown>) {
  ensureDir(filePath)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n")
}

function readToml(filePath: string): string {
  try {
    if (!fs.existsSync(filePath)) return ""
    return fs.readFileSync(filePath, "utf-8")
  } catch {
    return ""
  }
}

// Cursor: ~/.cursor/mcp.json
function cursorTarget(): IdeTarget {
  const configPath = path.join(home, ".cursor", "mcp.json")
  return {
    name: "Cursor",
    id: "cursor",
    configPath,
    detect: () => fs.existsSync(path.join(home, ".cursor")),
    read: () => readJson(configPath),
    write: (config) => writeJson(configPath, config),
  }
}

// Claude Desktop: ~/Library/Application Support/Claude/claude_desktop_config.json (macOS)
function claudeDesktopTarget(): IdeTarget {
  const configPath = process.platform === "darwin"
    ? path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json")
    : process.platform === "win32"
      ? path.join(process.env.APPDATA || "", "Claude", "claude_desktop_config.json")
      : path.join(home, ".config", "Claude", "claude_desktop_config.json")
  return {
    name: "Claude Desktop",
    id: "claude-desktop",
    configPath,
    detect: () => fs.existsSync(path.dirname(configPath)),
    read: () => readJson(configPath),
    write: (config) => writeJson(configPath, config),
  }
}

// Claude Code: ~/.claude.json
function claudeCodeTarget(): IdeTarget {
  const configPath = path.join(home, ".claude.json")
  return {
    name: "Claude Code",
    id: "claude-code",
    configPath,
    detect: () => fs.existsSync(path.join(home, ".claude")),
    read: () => readJson(configPath),
    write: (config) => writeJson(configPath, config),
  }
}

// Windsurf: ~/.codeium/windsurf/mcp_config.json
function windsurfTarget(): IdeTarget {
  const configPath = path.join(home, ".codeium", "windsurf", "mcp_config.json")
  return {
    name: "Windsurf",
    id: "windsurf",
    configPath,
    detect: () => fs.existsSync(path.join(home, ".codeium", "windsurf")),
    read: () => readJson(configPath),
    write: (config) => writeJson(configPath, config),
  }
}

// Codex CLI: ~/.codex/config.toml (TOML format, special handling)
function codexTarget(): IdeTarget {
  const configPath = path.join(home, ".codex", "config.toml")
  return {
    name: "Codex CLI",
    id: "codex",
    configPath,
    detect: () => fs.existsSync(path.join(home, ".codex")),
    read: () => {
      const content = readToml(configPath)
      if (content.includes("[mcp_servers.codeblog]")) return { _has_codeblog: true }
      return {}
    },
    write: () => {
      ensureDir(configPath)
      let content = readToml(configPath)
      if (content.includes("[mcp_servers.codeblog]")) return
      const block = [
        "",
        "[mcp_servers.codeblog]",
        `command = "npx"`,
        `args = ["-y", "codeblog-mcp@latest"]`,
        "",
      ].join("\n")
      content = content.trimEnd() + "\n" + block
      fs.writeFileSync(configPath, content)
    },
  }
}

// VS Code (Copilot): user settings or .vscode/mcp.json — we use global settings.json
function vscodeTarget(): IdeTarget {
  const configPath = process.platform === "darwin"
    ? path.join(home, "Library", "Application Support", "Code", "User", "settings.json")
    : process.platform === "win32"
      ? path.join(process.env.APPDATA || "", "Code", "User", "settings.json")
      : path.join(home, ".config", "Code", "User", "settings.json")
  return {
    name: "VS Code (Copilot)",
    id: "vscode",
    configPath,
    detect: () => fs.existsSync(path.dirname(configPath)),
    read: () => readJson(configPath),
    write: (config) => writeJson(configPath, config),
  }
}

const ALL_TARGETS = [
  cursorTarget,
  claudeDesktopTarget,
  claudeCodeTarget,
  windsurfTarget,
  codexTarget,
  vscodeTarget,
]

function alreadyConfigured(target: IdeTarget): boolean {
  const config = target.read()
  if (target.id === "codex") return !!config._has_codeblog
  if (target.id === "vscode") {
    const mcp = config.mcp as Record<string, unknown> | undefined
    const servers = mcp?.servers as Record<string, unknown> | undefined
    return !!servers?.codeblog
  }
  const servers = config.mcpServers as Record<string, unknown> | undefined
  return !!servers?.codeblog
}

function injectConfig(target: IdeTarget) {
  if (target.id === "codex") {
    target.write({})
    return
  }

  if (target.id === "vscode") {
    const config = target.read()
    const mcp = (config.mcp || {}) as Record<string, unknown>
    const servers = (mcp.servers || {}) as Record<string, unknown>
    servers.codeblog = { type: "stdio", ...MCP_SERVER_ENTRY }
    mcp.servers = servers
    config.mcp = mcp
    target.write(config)
    return
  }

  // Standard mcpServers format (Cursor, Claude Desktop, Claude Code, Windsurf)
  const config = target.read()
  const servers = (config.mcpServers || {}) as Record<string, unknown>
  servers.codeblog = { ...MCP_SERVER_ENTRY }
  config.mcpServers = servers
  target.write(config)
}

function detectTargets(): IdeTarget[] {
  const detected: IdeTarget[] = []
  for (const factory of ALL_TARGETS) {
    const target = factory()
    if (target.detect()) detected.push(target)
  }
  return detected
}

function buildLabels(targets: IdeTarget[]): string[] {
  return targets.map((t) => {
    const configured = alreadyConfigured(t)
    return configured
      ? `${t.name} ${UI.Style.TEXT_SUCCESS}(already configured)${UI.Style.TEXT_NORMAL}`
      : t.name
  })
}

function unconfiguredCount(targets: IdeTarget[]): number {
  return targets.filter((t) => !alreadyConfigured(t)).length
}

async function configureSelected(targets: IdeTarget[], indices: number[]): Promise<void> {
  let configured = 0
  let skipped = 0

  for (const i of indices) {
    const target = targets[i]!
    if (alreadyConfigured(target)) {
      console.log(`  ${UI.Style.TEXT_DIM}${target.name}: already configured, skipping${UI.Style.TEXT_NORMAL}`)
      skipped++
      continue
    }
    try {
      injectConfig(target)
      console.log(`  ${UI.Style.TEXT_SUCCESS}✓${UI.Style.TEXT_NORMAL} ${target.name}: configured ${UI.Style.TEXT_DIM}(${target.configPath})${UI.Style.TEXT_NORMAL}`)
      configured++
    } catch (err) {
      UI.warn(`${target.name}: failed — ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  console.log("")
  if (configured > 0) {
    UI.success(`Configured ${configured} IDE${configured > 1 ? "s" : ""}!${skipped > 0 ? ` (${skipped} already configured)` : ""}`)
    await UI.typeText("Restart your IDE(s) for the MCP configuration to take effect.", { charDelay: 8 })
  } else if (skipped > 0) {
    UI.info("All selected IDEs were already configured.")
  }
}

/**
 * Standalone wizard for `codeblog mcp init`.
 */
export async function mcpConfigWizard(): Promise<void> {
  const detected = detectTargets()

  if (detected.length === 0) {
    UI.info("No supported IDE detected on this machine.")
    console.log(`  ${UI.Style.TEXT_DIM}Supported: Cursor, Claude Desktop, Claude Code, Windsurf, Codex CLI, VS Code${UI.Style.TEXT_NORMAL}`)
    return
  }

  console.log("")
  await UI.typeText("Configure CodeBlog MCP in your IDEs.", { charDelay: 10 })
  await UI.typeText("This lets your AI coding agent access CodeBlog tools directly.", { charDelay: 8 })
  console.log("")

  const indices = await UI.multiSelect("  Select IDEs to configure", buildLabels(detected))

  if (indices.length === 0) {
    console.log("")
    UI.info("Skipped. You can run this again with: codeblog mcp init")
    return
  }

  console.log("")
  await configureSelected(detected, indices)
}

/**
 * Lightweight prompt for the setup wizard — asks first, then shows multi-select.
 */
export async function mcpSetupPrompt(): Promise<void> {
  const detected = detectTargets()
  if (detected.length === 0) return

  const pending = unconfiguredCount(detected)
  if (pending === 0) {
    UI.success("CodeBlog MCP is already configured in all your IDEs!")
    return
  }

  const names = detected.filter((t) => !alreadyConfigured(t)).map((t) => t.name)
  await UI.typeText("One more thing — we can set up CodeBlog MCP in your other IDEs.", { charDelay: 10 })
  await UI.typeText(`Detected: ${names.join(", ")}`, { charDelay: 6 })
  console.log("")

  const choice = await UI.waitEnter("Press Enter to configure, or Esc to skip")

  if (choice === "escape") {
    console.log("")
    await UI.typeText("No problem! You can configure later with: codeblog mcp init", { charDelay: 8 })
    return
  }

  console.log("")
  const indices = await UI.multiSelect("  Select IDEs to configure", buildLabels(detected))

  if (indices.length === 0) {
    console.log("")
    UI.info("Skipped. You can configure later with: codeblog mcp init")
    return
  }

  console.log("")
  await configureSelected(detected, indices)
}
