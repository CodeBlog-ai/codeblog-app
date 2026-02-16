import type { CommandModule } from "yargs"
import { UI } from "../ui"
import { Global } from "../../global"
import fs from "fs/promises"
import path from "path"
import os from "os"

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
    UI.println("")
    UI.warn("This will uninstall codeblog from your system.")

    if (!(args["keep-data"] as boolean)) {
      UI.println(`  The following directories will be removed:`)
      UI.println(`    ${UI.Style.TEXT_DIM}${Global.Path.config}${UI.Style.TEXT_NORMAL}`)
      UI.println(`    ${UI.Style.TEXT_DIM}${Global.Path.data}${UI.Style.TEXT_NORMAL}`)
      UI.println(`    ${UI.Style.TEXT_DIM}${Global.Path.cache}${UI.Style.TEXT_NORMAL}`)
      UI.println(`    ${UI.Style.TEXT_DIM}${Global.Path.state}${UI.Style.TEXT_NORMAL}`)
    }
    UI.println("")

    const answer = await UI.input(`  Type "yes" to confirm: `)
    if (answer.toLowerCase() !== "yes") {
      UI.info("Uninstall cancelled.")
      return
    }

    UI.println("")

    // 1. Remove data directories
    if (!(args["keep-data"] as boolean)) {
      const dirs = [Global.Path.config, Global.Path.data, Global.Path.cache, Global.Path.state]
      for (const dir of dirs) {
        try {
          await fs.rm(dir, { recursive: true, force: true })
          UI.success(`Removed ${dir}`)
        } catch {
          // ignore if already gone
        }
      }
    }

    // 2. Clean shell rc PATH entries (macOS/Linux only)
    if (os.platform() !== "win32") {
      await cleanShellRc()
    }

    // 3. Remove the binary itself
    const binPath = process.execPath
    const binDir = path.dirname(binPath)

    if (os.platform() === "win32") {
      // Windows: can't delete running exe, schedule removal
      UI.info(`Binary at ${binPath}`)
      UI.info("On Windows, please delete the binary manually after this process exits:")
      UI.println(`  ${UI.Style.TEXT_HIGHLIGHT}del "${binPath}"${UI.Style.TEXT_NORMAL}`)

      // Try to remove from PATH
      await cleanWindowsPath(binDir)
    } else {
      try {
        await fs.unlink(binPath)
        UI.success(`Removed binary: ${binPath}`)
      } catch (e: any) {
        if (e.code === "EBUSY" || e.code === "ETXTBSY") {
          // Binary is running, schedule delete via shell
          const { spawn } = await import("child_process")
          spawn("sh", ["-c", `sleep 1 && rm -f "${binPath}"`], {
            detached: true,
            stdio: "ignore",
          }).unref()
          UI.success(`Binary will be removed: ${binPath}`)
        } else {
          UI.warn(`Could not remove binary: ${e.message}`)
          UI.println(`  Remove it manually: ${UI.Style.TEXT_HIGHLIGHT}rm "${binPath}"${UI.Style.TEXT_NORMAL}`)
        }
      }
    }

    UI.println("")
    UI.success("codeblog has been uninstalled. Goodbye!")
    UI.println("")
  },
}

async function cleanShellRc() {
  const home = os.homedir()
  const rcFiles = [
    path.join(home, ".zshrc"),
    path.join(home, ".bashrc"),
    path.join(home, ".profile"),
  ]

  for (const rc of rcFiles) {
    try {
      const content = await fs.readFile(rc, "utf-8")
      if (!content.includes("# codeblog")) continue

      // Remove the "# codeblog" line and the export PATH line that follows
      const lines = content.split("\n")
      const filtered: string[] = []
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]!.trim() === "# codeblog") {
          // Skip this line and the next export PATH line
          if (i + 1 < lines.length && lines[i + 1]!.includes("export PATH=")) {
            i++ // skip next line too
          }
          // Also skip a preceding blank line if present
          if (filtered.length > 0 && filtered[filtered.length - 1]!.trim() === "") {
            filtered.pop()
          }
          continue
        }
        filtered.push(lines[i]!)
      }

      await fs.writeFile(rc, filtered.join("\n"), "utf-8")
      UI.success(`Cleaned PATH entry from ${rc}`)
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

    // Read current user PATH
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
      UI.success(`Removed ${binDir} from user PATH`)
    }
  } catch {
    UI.warn("Could not clean PATH. You may need to remove it manually from System Settings.")
  }
}
