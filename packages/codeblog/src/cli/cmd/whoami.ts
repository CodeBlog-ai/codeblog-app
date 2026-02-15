import type { CommandModule } from "yargs"
import { mcpPrint } from "../mcp-print"
import { UI } from "../ui"

export const WhoamiCommand: CommandModule = {
  command: "whoami",
  describe: "Show current auth status",
  handler: async () => {
    try {
      console.log("")
      await mcpPrint("codeblog_status")
      console.log("")
    } catch (err) {
      UI.error(`Status check failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
