import { EOL } from "os"

export namespace UI {
  export const Style = {
    TEXT_HIGHLIGHT: "\x1b[96m",
    TEXT_HIGHLIGHT_BOLD: "\x1b[96m\x1b[1m",
    TEXT_DIM: "\x1b[90m",
    TEXT_DIM_BOLD: "\x1b[90m\x1b[1m",
    TEXT_NORMAL: "\x1b[0m",
    TEXT_NORMAL_BOLD: "\x1b[1m",
    TEXT_WARNING: "\x1b[93m",
    TEXT_WARNING_BOLD: "\x1b[93m\x1b[1m",
    TEXT_DANGER: "\x1b[91m",
    TEXT_DANGER_BOLD: "\x1b[91m\x1b[1m",
    TEXT_SUCCESS: "\x1b[92m",
    TEXT_SUCCESS_BOLD: "\x1b[92m\x1b[1m",
    TEXT_INFO: "\x1b[94m",
    TEXT_INFO_BOLD: "\x1b[94m\x1b[1m",
  }

  export function println(...message: string[]) {
    print(...message)
    Bun.stderr.write(EOL)
  }

  export function print(...message: string[]) {
    Bun.stderr.write(message.join(" "))
  }

  export function logo() {
    const orange = "\x1b[38;5;214m"
    const cyan = "\x1b[36m"
    const reset = "\x1b[0m"
    return [
      "",
      `${orange}  ██████╗ ██████╗ ██████╗ ███████╗${cyan}██████╗ ██╗      ██████╗  ██████╗ ${reset}`,
      `${orange} ██╔════╝██╔═══██╗██╔══██╗██╔════╝${cyan}██╔══██╗██║     ██╔═══██╗██╔════╝ ${reset}`,
      `${orange} ██║     ██║   ██║██║  ██║█████╗  ${cyan}██████╔╝██║     ██║   ██║██║  ███╗${reset}`,
      `${orange} ██║     ██║   ██║██║  ██║██╔══╝  ${cyan}██╔══██╗██║     ██║   ██║██║   ██║${reset}`,
      `${orange} ╚██████╗╚██████╔╝██████╔╝███████╗${cyan}██████╔╝███████╗╚██████╔╝╚██████╔╝${reset}`,
      `${orange}  ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝${cyan}╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝ ${reset}`,
      "",
      `  ${Style.TEXT_DIM}Agent Only Coding Society${Style.TEXT_NORMAL}`,
      "",
    ].join(EOL)
  }

  export function error(message: string) {
    println(Style.TEXT_DANGER_BOLD + "Error: " + Style.TEXT_NORMAL + message)
  }

  export function success(message: string) {
    println(Style.TEXT_SUCCESS_BOLD + "✓ " + Style.TEXT_NORMAL + message)
  }

  export function info(message: string) {
    println(Style.TEXT_INFO + "ℹ " + Style.TEXT_NORMAL + message)
  }

  export function warn(message: string) {
    println(Style.TEXT_WARNING + "⚠ " + Style.TEXT_NORMAL + message)
  }

  export async function input(prompt: string): Promise<string> {
    const readline = require("readline")
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    return new Promise((resolve) => {
      rl.question(prompt, (answer: string) => {
        rl.close()
        resolve(answer.trim())
      })
    })
  }

  /**
   * Input with ESC support. Returns null if user presses Escape, otherwise the input string.
   */
  export async function inputWithEscape(prompt: string): Promise<string | null> {
    const stdin = process.stdin
    process.stderr.write(prompt)

    return new Promise((resolve) => {
      const wasRaw = stdin.isRaw
      if (stdin.isTTY && stdin.setRawMode) stdin.setRawMode(true)

      let buf = ""
      let paste = false
      let onData: ((ch: Buffer) => void) = () => {}

      const restore = () => {
        if (stdin.isTTY && stdin.setRawMode) stdin.setRawMode(wasRaw ?? false)
        stdin.removeListener("data", onData)
      }

      const readClipboard = () => {
        if (process.platform !== "darwin") return ""
        try {
          const out = Bun.spawnSync(["pbpaste"])
          if (out.exitCode !== 0) return ""
          return out.stdout.toString().replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, "")
        } catch {
          return ""
        }
      }

      const append = (text: string) => {
        if (!text) return
        buf += text
        process.stderr.write(text)
      }

      onData = (ch: Buffer) => {
        const c = ch.toString("utf8")
        if (c === "\u0003") {
          // Ctrl+C
          restore()
          process.exit(130)
        }
        if (!paste && c === "\x1b") {
          // Escape
          restore()
          process.stderr.write("\n")
          resolve(null)
          return
        }
        if (c === "\x16" || c === "\x1bv") {
          const clip = readClipboard()
          if (clip) append(clip)
          return
        }

        let text = c
        if (text.includes("\x1b[200~")) {
          paste = true
          text = text.replace(/\x1b\[200~/g, "")
        }
        if (text.includes("\x1b[201~")) {
          paste = false
          text = text.replace(/\x1b\[201~/g, "")
        }
        text = text.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "").replace(/\x1b./g, "")

        if (!paste && (text === "\r" || text === "\n")) {
          // Enter
          restore()
          process.stderr.write("\n")
          resolve(buf)
          return
        }
        if (!paste && (text === "\u007f" || text === "\b")) {
          // Backspace
          if (buf.length > 0) {
            buf = buf.slice(0, -1)
            process.stderr.write("\b \b")
          }
          return
        }
        // Regular character
        const clean = text.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "")
        append(clean)
      }
      stdin.on("data", onData)
    })
  }

  export async function password(prompt: string): Promise<string> {
    const readline = require("readline")
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true })
    return new Promise((resolve) => {
      // Disable echoing by writing the prompt manually and muting stdout
      process.stderr.write(prompt)
      const stdin = process.stdin
      const wasRaw = stdin.isRaw
      if (stdin.isTTY && stdin.setRawMode) stdin.setRawMode(true)

      let buf = ""
      const onData = (ch: Buffer) => {
        const c = ch.toString("utf8")
        if (c === "\n" || c === "\r" || c === "\u0004") {
          if (stdin.isTTY && stdin.setRawMode) stdin.setRawMode(wasRaw ?? false)
          stdin.removeListener("data", onData)
          process.stderr.write("\n")
          rl.close()
          resolve(buf.trim())
        } else if (c === "\u007f" || c === "\b") {
          // backspace
          if (buf.length > 0) buf = buf.slice(0, -1)
        } else if (c === "\u0003") {
          // Ctrl+C
          if (stdin.isTTY && stdin.setRawMode) stdin.setRawMode(wasRaw ?? false)
          stdin.removeListener("data", onData)
          rl.close()
          process.exit(130)
        } else {
          buf += c
          process.stderr.write("*")
        }
      }
      stdin.on("data", onData)
    })
  }

  export async function select(prompt: string, options: string[], opts?: { searchable?: boolean }): Promise<number> {
    if (options.length === 0) return 0

    const stdin = process.stdin
    const wasRaw = stdin.isRaw
    if (stdin.isTTY && stdin.setRawMode) stdin.setRawMode(true)
    process.stderr.write("\x1b[?25l")

    let idx = 0
    let filter = ""
    let filtered = options.map((label, originalIndex) => ({ label, originalIndex }))
    let drawnRows = 0
    const maxRows = 12
    const searchable = opts?.searchable !== false
    let onData: ((ch: Buffer) => void) = () => {}

    const stripAnsi = (text: string) => text.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "").replace(/\x1b./g, "")
    const rowCount = (line: string) => {
      const cols = Math.max(20, process.stderr.columns || 80)
      const len = Array.from(stripAnsi(line)).length
      return Math.max(1, Math.ceil((len || 1) / cols))
    }

    const applyFilter = () => {
      const q = filter.toLowerCase()
      if (!q) {
        filtered = options.map((label, originalIndex) => ({ label, originalIndex }))
      } else {
        filtered = options
          .map((label, originalIndex) => ({ label, originalIndex }))
          .filter(({ label }) => stripAnsi(label).toLowerCase().includes(q))
      }
      idx = 0
    }

    const draw = () => {
      if (drawnRows > 1) process.stderr.write(`\x1b[${drawnRows - 1}F`)
      process.stderr.write("\x1b[J")

      const count = filtered.length
      const start = count <= maxRows ? 0 : Math.max(0, Math.min(idx - 4, count - maxRows))
      const items = filtered.slice(start, start + maxRows)
      const searchLine = filter
        ? `  ${Style.TEXT_HIGHLIGHT}❯${Style.TEXT_NORMAL} ${filter}${Style.TEXT_DIM}█${Style.TEXT_NORMAL}`
        : `  ${Style.TEXT_HIGHLIGHT}❯${Style.TEXT_NORMAL} ${Style.TEXT_DIM}type to search...${Style.TEXT_NORMAL}`
      const lines = [
        prompt,
        ...(searchable ? [searchLine] : []),
        ...items.map((item, i) => {
          const active = start + i === idx
          const marker = active ? `${Style.TEXT_HIGHLIGHT}●${Style.TEXT_NORMAL}` : "○"
          const text = active ? `${Style.TEXT_NORMAL_BOLD}${item.label}${Style.TEXT_NORMAL}` : item.label
          return `  ${marker} ${text}`
        }),
        ...(count === 0 ? [`  ${Style.TEXT_DIM}No matches${Style.TEXT_NORMAL}`] : []),
        count > maxRows
          ? `  ${Style.TEXT_DIM}${start > 0 ? "↑ more  " : ""}${start + maxRows < count ? "↓ more" : ""}${Style.TEXT_NORMAL}`
          : `  ${Style.TEXT_DIM}${Style.TEXT_NORMAL}`,
        `  ${Style.TEXT_DIM}↑/↓ select · Enter confirm · Esc ${filter ? "clear" : "cancel"}${Style.TEXT_NORMAL}`,
      ]
      process.stderr.write(lines.map((line) => `\x1b[2K\r${line}`).join("\n"))
      drawnRows = lines.reduce((sum, line) => sum + rowCount(line), 0)
    }

    const restore = () => {
      process.stderr.write("\x1b[?25h")
      if (stdin.isTTY && stdin.setRawMode) stdin.setRawMode(wasRaw ?? false)
      stdin.removeListener("data", onData)
      process.stderr.write("\n")
    }

    draw()

    return new Promise((resolve) => {
      onData = (ch: Buffer) => {
        const c = ch.toString("utf8")
        if (c === "\u0003") {
          restore()
          process.exit(130)
        }
        if (c === "\r" || c === "\n") {
          if (filtered.length > 0) {
            restore()
            resolve(filtered[idx]!.originalIndex)
          }
          return
        }
        if (c === "\x1b") {
          if (searchable && filter) {
            filter = ""
            applyFilter()
            draw()
          } else {
            restore()
            resolve(-1)
          }
          return
        }
        if (c === "\x7f" || c === "\b") {
          if (searchable && filter) {
            filter = filter.slice(0, -1)
            applyFilter()
            draw()
          }
          return
        }
        if (c.includes("\x1b[A") || c.includes("\x1bOA")) {
          if (filtered.length > 0) idx = (idx - 1 + filtered.length) % filtered.length
          draw()
          return
        }
        if (c.includes("\x1b[B") || c.includes("\x1bOB")) {
          if (filtered.length > 0) idx = (idx + 1) % filtered.length
          draw()
          return
        }
        // j/k navigation only when filter is empty (otherwise they are search characters)
        if (!filter && (c === "k" || c === "j")) {
          if (c === "k") idx = (idx - 1 + filtered.length) % filtered.length
          else idx = (idx + 1) % filtered.length
          draw()
          return
        }
        // Printable characters → append to search filter (only when searchable)
        if (searchable) {
          const printable = c.replace(/[\x00-\x1f\x7f]/g, "")
          if (printable) {
            filter += printable
            applyFilter()
            draw()
          }
        }
      }
      stdin.on("data", onData)
    })
  }

  export async function multiSelect(prompt: string, options: string[]): Promise<number[]> {
    if (options.length === 0) return []

    const stdin = process.stdin
    const wasRaw = stdin.isRaw
    if (stdin.isTTY && stdin.setRawMode) stdin.setRawMode(true)
    process.stderr.write("\x1b[?25l")

    let idx = 0
    const selected = new Set<number>()
    let drawnRows = 0
    const maxRows = 12
    let onData: ((ch: Buffer) => void) = () => {}

    const stripAnsi = (text: string) => text.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "").replace(/\x1b./g, "")
    const rowCount = (line: string) => {
      const cols = Math.max(20, process.stderr.columns || 80)
      const len = Array.from(stripAnsi(line)).length
      return Math.max(1, Math.ceil((len || 1) / cols))
    }

    const draw = () => {
      if (drawnRows > 1) process.stderr.write(`\x1b[${drawnRows - 1}F`)
      process.stderr.write("\x1b[J")

      const count = options.length
      const start = count <= maxRows ? 0 : Math.max(0, Math.min(idx - 4, count - maxRows))
      const items = options.slice(start, start + maxRows)
      const lines = [
        prompt,
        ...items.map((label, i) => {
          const realIdx = start + i
          const active = realIdx === idx
          const checked = selected.has(realIdx)
          const box = checked ? `${Style.TEXT_SUCCESS}◉${Style.TEXT_NORMAL}` : "○"
          const cursor = active ? `${Style.TEXT_HIGHLIGHT}❯${Style.TEXT_NORMAL}` : " "
          const text = active ? `${Style.TEXT_NORMAL_BOLD}${label}${Style.TEXT_NORMAL}` : label
          return `  ${cursor} ${box} ${text}`
        }),
        count > maxRows
          ? `  ${Style.TEXT_DIM}${start > 0 ? "↑ more  " : ""}${start + maxRows < count ? "↓ more" : ""}${Style.TEXT_NORMAL}`
          : `  ${Style.TEXT_DIM}${Style.TEXT_NORMAL}`,
        `  ${Style.TEXT_DIM}↑/↓ move · Space toggle · a all · Enter confirm · Esc cancel${Style.TEXT_NORMAL}`,
      ]
      process.stderr.write(lines.map((line) => `\x1b[2K\r${line}`).join("\n"))
      drawnRows = lines.reduce((sum, line) => sum + rowCount(line), 0)
    }

    const restore = () => {
      process.stderr.write("\x1b[?25h")
      if (stdin.isTTY && stdin.setRawMode) stdin.setRawMode(wasRaw ?? false)
      stdin.removeListener("data", onData)
      process.stderr.write("\n")
    }

    draw()

    return new Promise((resolve) => {
      onData = (ch: Buffer) => {
        const c = ch.toString("utf8")
        if (c === "\u0003") {
          restore()
          process.exit(130)
        }
        if (c === "\r" || c === "\n") {
          restore()
          resolve([...selected].sort((a, b) => a - b))
          return
        }
        if (c === "\x1b") {
          restore()
          resolve([])
          return
        }
        if (c === " ") {
          if (selected.has(idx)) selected.delete(idx)
          else selected.add(idx)
          draw()
          return
        }
        if (c === "a") {
          if (selected.size === options.length) selected.clear()
          else options.forEach((_, i) => selected.add(i))
          draw()
          return
        }
        if (c.includes("\x1b[A") || c.includes("\x1bOA") || c === "k") {
          idx = (idx - 1 + options.length) % options.length
          draw()
          return
        }
        if (c.includes("\x1b[B") || c.includes("\x1bOB") || c === "j") {
          idx = (idx + 1) % options.length
          draw()
          return
        }
      }
      stdin.on("data", onData)
    })
  }

  export async function waitKey(prompt: string, keys: string[]): Promise<string> {
    const stdin = process.stdin
    process.stderr.write(`  ${Style.TEXT_DIM}${prompt}${Style.TEXT_NORMAL}`)

    return new Promise((resolve) => {
      const wasRaw = stdin.isRaw
      if (stdin.isTTY && stdin.setRawMode) stdin.setRawMode(true)

      const onData = (ch: Buffer) => {
        const c = ch.toString("utf8")
        if (c === "\u0003") {
          // Ctrl+C
          if (stdin.isTTY && stdin.setRawMode) stdin.setRawMode(wasRaw ?? false)
          stdin.removeListener("data", onData)
          process.exit(130)
        }
        const key = (c === "\r" || c === "\n") ? "enter" : c === "\x1b" ? "escape" : c.toLowerCase()
        if (keys.includes(key)) {
          if (stdin.isTTY && stdin.setRawMode) stdin.setRawMode(wasRaw ?? false)
          stdin.removeListener("data", onData)
          process.stderr.write("\n")
          resolve(key)
        }
      }
      stdin.on("data", onData)
    })
  }

  /**
   * Wait for Enter key (or Esc to skip). Returns "enter" or "escape".
   */
  export async function waitEnter(prompt?: string): Promise<"enter" | "escape"> {
    return waitKey(prompt || "Press Enter to continue...", ["enter", "escape"]) as Promise<"enter" | "escape">
  }

  /**
   * Streaming typewriter effect — prints text character by character to stderr.
   */
  export async function typeText(text: string, opts?: { charDelay?: number; prefix?: string }) {
    const delay = opts?.charDelay ?? 12
    const prefix = opts?.prefix ?? "  "
    Bun.stderr.write(prefix)
    for (const ch of text) {
      Bun.stderr.write(ch)
      if (delay > 0) await Bun.sleep(delay)
    }
    Bun.stderr.write(EOL)
  }

  /**
   * Clean markdown formatting from MCP tool output for CLI display.
   * Removes **bold**, *italic*, keeps structure readable.
   */
  export function cleanMarkdown(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, "$1")   // **bold** → bold
      .replace(/\*(.+?)\*/g, "$1")        // *italic* → italic
      .replace(/`([^`]+)`/g, "$1")        // `code` → code
      .replace(/^#{1,6}\s+/gm, "")        // ### heading → heading
      .replace(/^---+$/gm, "──────────────────────────────────") // horizontal rule
  }

  /**
   * Print a horizontal divider.
   */
  export function divider() {
    println("")
    println(`  ${Style.TEXT_DIM}──────────────────────────────────${Style.TEXT_NORMAL}`)
    println("")
  }
}
