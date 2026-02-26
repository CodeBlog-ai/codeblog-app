import type { CommandModule } from "yargs"
import { AIChat } from "../../ai/chat"
import { AIProvider } from "../../ai/provider"
import { Config } from "../../config"
import { Global } from "../../global"
import { UI } from "../ui"
import * as fs from "fs/promises"
import * as fsSync from "fs"
import * as path from "path"
import * as os from "os"
import { execSync, spawn } from "child_process"

const COMPANION_SCAN_PROMPT = `You are a background coding companion running a silent scan. Your job is to find IDE sessions with insights worth saving as draft blog posts.

Follow these steps:

1. Call scan_sessions with limit=20 to get recent sessions.

2. For each session, check if it's worth analyzing:
   - Skip sessions with fewer than 10 messages (too short)
   - Skip sessions where analyzed=true
   - Focus on sessions modified in the last 48 hours

3. Pick up to 3 candidate sessions. For each, call analyze_session to understand the content.

4. For each analyzed session, decide if it contains a compelling insight:
   WORTH SAVING AS DRAFT if ANY of:
   - A non-obvious bug was found and solved (not just a typo)
   - A new technique, pattern, or API was discovered
   - An architectural decision was made with interesting trade-offs
   - A genuine "TIL" moment that other developers would find valuable
   - A performance insight with measurable impact

   NOT WORTH SAVING if:
   - Pure mechanical work (renaming, formatting, minor config tweaks)
   - Session is incomplete or inconclusive
   - Trivial syntax or typo fixes
   - Generic "I added a feature" with no deeper insight

5. For sessions worth saving, call create_draft with:
   - A specific, compelling title (e.g. "Why Prisma silently drops your WHERE clause when you pass undefined" NOT "Debugging session")
   - Content written in first person as the AI agent: "I noticed...", "We discovered...", "The insight here is..."
   - Category: 'til' for discoveries, 'bugs' for bug stories, 'general' for architectural insights
   - Tags from the actual languages/frameworks used
   - source_session set to the exact session path from scan_sessions

IMPORTANT: You are running silently in the background. Output only a brief final summary line, e.g.:
"Companion scan complete: 8 sessions checked, 1 draft saved."
Do NOT output verbose step-by-step commentary.`

function getLaunchAgentPath(): string {
  return path.join(os.homedir(), "Library", "LaunchAgents", "ai.codeblog.companion.plist")
}

function getSystemdServicePath(): string {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config")
  return path.join(configHome, "systemd", "user", "codeblog-companion.service")
}

function getSystemdTimerPath(): string {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config")
  return path.join(configHome, "systemd", "user", "codeblog-companion.timer")
}

function getCompanionLogPath(): string {
  return path.join(Global.Path.log, "companion.log")
}

function getCompanionStatePath(): string {
  return path.join(Global.Path.state, "companion.json")
}

interface CompanionState {
  lastRunAt?: string
  lastDraftsCreated?: number
  lastSessionsScanned?: number
  installMethod?: "launchd" | "systemd"
}

async function readState(): Promise<CompanionState> {
  try {
    const raw = await fs.readFile(getCompanionStatePath(), "utf-8")
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

async function writeState(state: Partial<CompanionState>): Promise<void> {
  const current = await readState()
  const merged = { ...current, ...state }
  await fs.writeFile(getCompanionStatePath(), JSON.stringify(merged, null, 2))
}

function getCodeblogBinPath(): string {
  // Use the actual binary path (resolved from process.argv[1] if available)
  const argv1 = process.argv[1]
  if (argv1 && fsSync.existsSync(argv1)) return argv1
  // Fallback: search PATH
  try {
    return execSync("which codeblog", { encoding: "utf-8" }).trim()
  } catch {
    return "codeblog"
  }
}

async function installMacOS(intervalMinutes: number): Promise<void> {
  const plistPath = getLaunchAgentPath()
  const binPath = getCodeblogBinPath()
  const logPath = getCompanionLogPath()
  const intervalSeconds = intervalMinutes * 60

  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>ai.codeblog.companion</string>
  <key>ProgramArguments</key>
  <array>
    <string>${binPath}</string>
    <string>companion</string>
    <string>run</string>
  </array>
  <key>StartInterval</key>
  <integer>${intervalSeconds}</integer>
  <key>RunAtLoad</key>
  <false/>
  <key>StandardOutPath</key>
  <string>${logPath}</string>
  <key>StandardErrorPath</key>
  <string>${logPath}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
    <key>HOME</key>
    <string>${os.homedir()}</string>
  </dict>
</dict>
</plist>`

  await fs.mkdir(path.dirname(plistPath), { recursive: true })
  await fs.writeFile(plistPath, plistContent)

  // Unload first (if already loaded), then load
  try { execSync(`launchctl unload "${plistPath}" 2>/dev/null`, { stdio: "ignore" }) } catch {}
  execSync(`launchctl load "${plistPath}"`)
}

async function installLinux(intervalMinutes: number): Promise<void> {
  const servicePath = getSystemdServicePath()
  const timerPath = getSystemdTimerPath()
  const binPath = getCodeblogBinPath()
  const logPath = getCompanionLogPath()

  const serviceContent = `[Unit]
Description=CodeBlog Companion - background coding session scanner
After=network.target

[Service]
Type=oneshot
ExecStart=${binPath} companion run
StandardOutput=append:${logPath}
StandardError=append:${logPath}
Environment=HOME=${os.homedir()}

[Install]
WantedBy=default.target`

  const timerContent = `[Unit]
Description=CodeBlog Companion timer - runs every ${intervalMinutes} minutes

[Timer]
OnBootSec=5min
OnUnitActiveSec=${intervalMinutes}min
Unit=codeblog-companion.service

[Install]
WantedBy=timers.target`

  await fs.mkdir(path.dirname(servicePath), { recursive: true })
  await fs.writeFile(servicePath, serviceContent)
  await fs.writeFile(timerPath, timerContent)

  execSync("systemctl --user daemon-reload")
  execSync("systemctl --user enable --now codeblog-companion.timer")
}

async function stopMacOS(): Promise<void> {
  const plistPath = getLaunchAgentPath()
  try {
    execSync(`launchctl unload "${plistPath}"`)
    await fs.unlink(plistPath)
  } catch (e) {
    throw new Error(`Failed to stop launchd job: ${e}`)
  }
}

async function stopLinux(): Promise<void> {
  try {
    execSync("systemctl --user disable --now codeblog-companion.timer")
    await fs.unlink(getSystemdServicePath()).catch(() => {})
    await fs.unlink(getSystemdTimerPath()).catch(() => {})
    execSync("systemctl --user daemon-reload")
  } catch (e) {
    throw new Error(`Failed to stop systemd timer: ${e}`)
  }
}

function isRunningMacOS(): boolean {
  try {
    const output = execSync("launchctl list ai.codeblog.companion 2>/dev/null", { encoding: "utf-8" })
    return output.includes("ai.codeblog.companion")
  } catch {
    return false
  }
}

function isRunningLinux(): boolean {
  try {
    const output = execSync("systemctl --user is-active codeblog-companion.timer 2>/dev/null", {
      encoding: "utf-8",
    }).trim()
    return output === "active"
  } catch {
    return false
  }
}

const CompanionStartCommand: CommandModule = {
  command: "start",
  describe: "Install and start the background companion daemon",
  builder: (yargs) =>
    yargs.option("interval", {
      describe: "Scan interval in minutes (default: 120)",
      type: "number",
      default: 120,
    }),
  handler: async (args) => {
    const interval = args.interval as number
    const platform = os.platform()

    UI.info(`Installing CodeBlog Companion (every ${interval} min)...`)

    try {
      if (platform === "darwin") {
        await installMacOS(interval)
        await writeState({ installMethod: "launchd" })
        UI.success(`Companion installed via launchd. It will scan your IDE sessions every ${interval} minutes.`)
        UI.info(`Log file: ${getCompanionLogPath()}`)
      } else if (platform === "linux") {
        await installLinux(interval)
        await writeState({ installMethod: "systemd" })
        UI.success(`Companion installed via systemd. It will scan your IDE sessions every ${interval} minutes.`)
        UI.info(`Log file: ${getCompanionLogPath()}`)
      } else {
        UI.error(`Unsupported platform: ${platform}. Only macOS and Linux are supported.`)
        process.exitCode = 1
      }
    } catch (err) {
      UI.error(`Failed to install companion: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}

const CompanionStopCommand: CommandModule = {
  command: "stop",
  describe: "Stop and uninstall the background companion daemon",
  handler: async () => {
    const platform = os.platform()

    try {
      if (platform === "darwin") {
        await stopMacOS()
        UI.success("Companion stopped and removed.")
      } else if (platform === "linux") {
        await stopLinux()
        UI.success("Companion stopped and removed.")
      } else {
        UI.error(`Unsupported platform: ${platform}.`)
        process.exitCode = 1
        return
      }
      await writeState({ installMethod: undefined })
    } catch (err) {
      UI.error(`Failed to stop companion: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}

const CompanionStatusCommand: CommandModule = {
  command: "status",
  describe: "Show companion daemon status and recent activity",
  handler: async () => {
    const platform = os.platform()
    const state = await readState()

    let isRunning = false
    if (platform === "darwin") {
      isRunning = isRunningMacOS()
    } else if (platform === "linux") {
      isRunning = isRunningLinux()
    }

    console.log("")
    if (isRunning) {
      UI.success("Companion is RUNNING")
    } else {
      UI.warn("Companion is NOT running. Use 'codeblog companion start' to enable it.")
    }

    if (state.lastRunAt) {
      console.log(`  Last run:     ${new Date(state.lastRunAt).toLocaleString()}`)
    }
    if (state.lastSessionsScanned !== undefined) {
      console.log(`  Last scan:    ${state.lastSessionsScanned} sessions checked`)
    }
    if (state.lastDraftsCreated !== undefined) {
      console.log(`  Last result:  ${state.lastDraftsCreated} draft(s) created`)
    }
    if (isRunning) {
      const logPath = getCompanionLogPath()
      console.log(`  Log file:     ${logPath}`)
    }
    console.log("")
  },
}

const CompanionRunCommand: CommandModule = {
  command: "run",
  describe: "Run one companion scan immediately (also called by the daemon)",
  handler: async () => {
    const hasKey = await AIProvider.hasAnyKey()
    if (!hasKey) {
      // Silent failure when running as daemon (no terminal)
      process.exitCode = 1
      return
    }

    const cfg = await Config.load()
    const minMessages = cfg.companion?.minSessionMessages ?? 10

    const prompt = `${COMPANION_SCAN_PROMPT}

Additional context: skip sessions with fewer than ${minMessages} messages.`

    // Record start time
    const startTime = new Date().toISOString()

    let summaryLine = ""
    await AIChat.stream(
      [{ role: "user", content: prompt }],
      {
        onToken: (token) => {
          summaryLine += token
          // When running as daemon, write to stdout (captured by launchd/systemd to log)
          process.stdout.write(token)
        },
        onFinish: () => {
          process.stdout.write("\n")
        },
        onError: (err) => {
          process.stderr.write(`Companion scan error: ${err.message}\n`)
        },
      },
    )

    // Parse summary line for state update (best-effort)
    const draftsMatch = summaryLine.match(/(\d+)\s+draft/i)
    const sessionsMatch = summaryLine.match(/(\d+)\s+session/i)
    await writeState({
      lastRunAt: startTime,
      lastDraftsCreated: draftsMatch ? parseInt(draftsMatch[1]!) : 0,
      lastSessionsScanned: sessionsMatch ? parseInt(sessionsMatch[1]!) : 0,
    })
  },
}

export const CompanionCommand: CommandModule = {
  command: "companion <subcommand>",
  describe: "Manage the background AI coding companion",
  builder: (yargs) =>
    yargs
      .command(CompanionStartCommand)
      .command(CompanionStopCommand)
      .command(CompanionStatusCommand)
      .command(CompanionRunCommand)
      .demandCommand(1, "Specify a subcommand: start, stop, status, run"),
  handler: () => {},
}
