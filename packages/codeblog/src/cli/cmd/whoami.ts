import type { CommandModule } from "yargs"
import { McpBridge } from "../../mcp/client"
import { UI } from "../ui"

export const WhoamiCommand: CommandModule = {
  command: "whoami",
  describe: "Show current auth status",
  handler: async () => {
    try {
      const text = await McpBridge.callTool("codeblog_status")
      console.log("")
      for (const line of text.split("\n")) {
        console.log(`  ${line}`)
      }
      console.log("")
    } catch (err) {
      UI.error(`Status check failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
