import type { CommandModule } from "yargs"
import { UI } from "../ui"
import { Global } from "../../global"
import fs from "fs/promises"
import path from "path"
import os from "os"

const DIM = "\x1b[90m"
const RESET = "\x1b[0m"
const BOLD = "\x1b[1m"
const RED = "\x1b[91m"
const GREEN = "\x1b[92m"
const YELLOW = "\x1b[93m"
const CYAN = "\x1b[36m"

const W = 60  // inner width of the box
const BAR = `${DIM}│${RESET}`

/** Strip ANSI escape sequences to get visible character length */
function visLen(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, "").length
}

function line(text = "") {
  const pad = Math.max(0, W - visLen(text) - 1)
  console.log(`  ${BAR} ${text}${" ".repeat(pad)}${BAR}`)
}

function lineSuccess(text: string) {
  line(`${GREEN}✓${RESET} ${text}`)
}

function lineWarn(text: string) {
  line(`${YELLOW}⚠${RESET} ${text}`)
}

function lineInfo(text: string) {
  line(`${DIM}${text}${RESET}`)
}

export const UninstallCommand: CommandModule = {
  command: "uninstall",
  describe: "Uninstall codeblog CLI and remove all local data",
  builder: (yargs) =>
    yargs.option("keep-data", {
      describe: "Keep config, data, and cache (only remove binary)",
      type: "boolean",
      default: false,
    }),
  handler: async (args) => {
    const keepData = args["keep-data"] as boolean
    const binPath = process.execPath
    const pkg = await import("../../../package.json")

    console.log(UI.logo())

    // Top border
    console.log(`  ${DIM}┌${"─".repeat(W)}┐${RESET}`)
    line()
    line(`${RED}${BOLD}Uninstall CodeBlog${RESET}  ${DIM}v${pkg.version}${RESET}`)
    line()

    // Show what will be removed
    line(`${BOLD}The following will be removed:${RESET}`)
    line()
    line(`  ${DIM}Binary${RESET}    ${binPath}`)

    if (!keepData) {
      const dirs = [Global.Path.config, Global.Path.data, Global.Path.cache, Global.Path.state]
      for (const dir of dirs) {
        const label = dir.includes("config") ? "Config" : dir.includes("data") || dir.includes("share") ? "Data" : dir.includes("cache") ? "Cache" : "State"
        try {
          await fs.access(dir)
          line(`  ${DIM}${label.padEnd(10)}${RESET}${dir}`)
        } catch {
          // dir doesn't exist, skip
        }
      }
    }

    if (os.platform() !== "win32") {
      const rcFiles = getShellRcFiles()
      for (const rc of rcFiles) {
        try {
          const content = await fs.readFile(rc, "utf-8")
          if (content.includes("# codeblog")) {
            line(`  ${DIM}Shell RC${RESET}  ${rc} ${DIM}(PATH entry)${RESET}`)
          }
        } catch {}
      }
    }

    line()

    // Separator
    console.log(`  ${DIM}├${"─".repeat(W)}┤${RESET}`)
    line()

    // Confirm
    line(`${BOLD}Type "yes" to confirm uninstall:${RESET}`)
    process.stderr.write(`  ${BAR} ${DIM}> ${RESET}`)
    const answer = await readLine()
    // Print the line with right border after input
    const inputDisplay = answer || ""
    const inputLine = `${DIM}> ${RESET}${inputDisplay}`
    const inputPad = Math.max(0, W - visLen(inputLine) - 1)
    process.stderr.write(`\x1b[A\r  ${BAR} ${inputLine}${" ".repeat(inputPad)}${BAR}\n`)

    if (answer.toLowerCase() !== "yes") {
      line()
      line(`Uninstall cancelled.`)
      line()
      console.log(`  ${DIM}└${"─".repeat(W)}┘${RESET}`)
      console.log("")
      return
    }

    line()

    // Execute uninstall steps
    // 1. Remove data directories
    if (!keepData) {
      const dirs = [Global.Path.config, Global.Path.data, Global.Path.cache, Global.Path.state]
      for (const dir of dirs) {
        try {
          await fs.access(dir)
          await fs.rm(dir, { recursive: true, force: true })
          lineSuccess(`Removed ${dir}`)
        } catch {
          // dir doesn't exist
        }
      }
    }

    // 2. Clean shell rc PATH entries (macOS/Linux only)
    if (os.platform() !== "win32") {
      await cleanShellRc()
    }

    // 3. Remove the binary
    const binDir = path.dirname(binPath)

    if (os.platform() === "win32") {
      lineInfo(`Binary at ${binPath}`)
      lineWarn(`On Windows, delete manually after exit:`)
      line(`  ${CYAN}del "${binPath}"${RESET}`)
      await cleanWindowsPath(binDir)
    } else {
      try {
        await fs.unlink(binPath)
        lineSuccess(`Removed ${binPath}`)
      } catch (e: any) {
        if (e.code === "EBUSY" || e.code === "ETXTBSY") {
          const { spawn } = await import("child_process")
          spawn("sh", ["-c", `sleep 1 && rm -f "${binPath}"`], {
            detached: true,
            stdio: "ignore",
          }).unref()
          lineSuccess(`Binary will be removed: ${binPath}`)
        } else {
          lineWarn(`Could not remove binary: ${e.message}`)
          line(`  Run manually: ${CYAN}rm "${binPath}"${RESET}`)
        }
      }
    }

    line()

    // Separator
    console.log(`  ${DIM}├${"─".repeat(W)}┤${RESET}`)
    line()
    line(`${GREEN}${BOLD}CodeBlog has been uninstalled.${RESET} Goodbye!`)
    line()

    // Bottom border
    console.log(`  ${DIM}└${"─".repeat(W)}┘${RESET}`)
    console.log("")
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readLine(): Promise<string> {
  const stdin = process.stdin
  return new Promise((resolve) => {
    const wasRaw = stdin.isRaw
    if (stdin.isTTY && stdin.setRawMode) stdin.setRawMode(true)

    let buf = ""
    const onData = (ch: Buffer) => {
      const c = ch.toString("utf8")
      if (c === "\u0003") {
        if (stdin.isTTY && stdin.setRawMode) stdin.setRawMode(wasRaw ?? false)
        stdin.removeListener("data", onData)
        process.exit(130)
      }
      if (c === "\r" || c === "\n") {
        if (stdin.isTTY && stdin.setRawMode) stdin.setRawMode(wasRaw ?? false)
        stdin.removeListener("data", onData)
        process.stderr.write("\n")
        resolve(buf)
        return
      }
      if (c === "\u007f" || c === "\b") {
        if (buf.length > 0) {
          buf = buf.slice(0, -1)
          process.stderr.write("\b \b")
        }
        return
      }
      const clean = c.replace(/[\x00-\x1f\x7f]/g, "")
      if (clean) {
        buf += clean
        process.stderr.write(clean)
      }
    }
    stdin.on("data", onData)
  })
}

function getShellRcFiles(): string[] {
  const home = os.homedir()
  return [
    path.join(home, ".zshrc"),
    path.join(home, ".bashrc"),
    path.join(home, ".profile"),
  ]
}

async function cleanShellRc() {
  for (const rc of getShellRcFiles()) {
    try {
      const content = await fs.readFile(rc, "utf-8")
      if (!content.includes("# codeblog")) continue

      const lines = content.split("\n")
      const filtered: string[] = []
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]!.trim() === "# codeblog") {
          if (i + 1 < lines.length && lines[i + 1]!.includes("export PATH=")) {
            i++
          }
          if (filtered.length > 0 && filtered[filtered.length - 1]!.trim() === "") {
            filtered.pop()
          }
          continue
        }
        filtered.push(lines[i]!)
      }

      await fs.writeFile(rc, filtered.join("\n"), "utf-8")
      lineSuccess(`Cleaned PATH from ${rc}`)
    } catch {
      // file doesn't exist or not readable
    }
  }
}

async function cleanWindowsPath(binDir: string) {
  try {
    const { exec } = await import("child_process")
    const { promisify } = await import("util")
    const execAsync = promisify(exec)

    const { stdout } = await execAsync(
      `powershell -Command "[Environment]::GetEnvironmentVariable('Path','User')"`,
    )
    const currentPath = stdout.trim()
    const parts = currentPath.split(";").filter((p) => p && p !== binDir)
    const newPath = parts.join(";")

    if (newPath !== currentPath) {
      await execAsync(
        `powershell -Command "[Environment]::SetEnvironmentVariable('Path','${newPath}','User')"`,
      )
      lineSuccess(`Removed ${binDir} from user PATH`)
    }
  } catch {
    lineWarn("Could not clean PATH. Remove manually from System Settings.")
  }
}
