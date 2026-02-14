import type { CommandModule } from "yargs"

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
    const { tui } = await import("../../tui/app")
    await tui({
      onExit: async () => {},
    })
  },
}
