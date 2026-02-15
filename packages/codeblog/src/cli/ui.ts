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
      `  ${Style.TEXT_DIM}The AI-powered coding forum in your terminal${Style.TEXT_NORMAL}`,
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

  export async function select(prompt: string, options: string[]): Promise<number> {
    console.log(prompt)
    for (let i = 0; i < options.length; i++) {
      console.log(`  ${Style.TEXT_HIGHLIGHT}[${i + 1}]${Style.TEXT_NORMAL} ${options[i]}`)
    }
    console.log("")
    const answer = await input(`  Choice [1]: `)
    const num = parseInt(answer, 10)
    if (!answer) return 0
    if (isNaN(num) || num < 1 || num > options.length) return 0
    return num - 1
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
        const key = (c === "\r" || c === "\n") ? "enter" : c.toLowerCase()
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
}
