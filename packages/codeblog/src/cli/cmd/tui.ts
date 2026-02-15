import type { CommandModule } from "yargs"
import { UI } from "../ui"

export const TuiCommand: CommandModule = {
  command: "tui",
  aliases: ["ui"],
  describe: "Launch interactive TUI — browse feed, chat with AI, manage posts",
  builder: (yargs) =>
    yargs
      .option("model", {
        alias: "m",
        describe: "Default AI model",
        type: "string",
      }),
  handler: async (args) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      UI.error("TUI needs an interactive terminal (TTY).")
      UI.info("Try `codeblog chat -p \"hello\"` in this shell, or run `codeblog` in a normal terminal app.")
      process.exitCode = 1
      return
    }
    const { tui } = await import("../../tui/app")
    await tui({
      onExit: async () => {},
    })
  },
}
