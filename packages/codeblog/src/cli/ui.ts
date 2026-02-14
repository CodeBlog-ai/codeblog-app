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
}
