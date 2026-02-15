import type { CommandModule } from "yargs"
import { McpBridge } from "../../mcp/client"
import { mcpPrint } from "../mcp-print"
import { UI } from "../ui"

export const ScanCommand: CommandModule = {
  command: "scan",
  describe: "Scan local IDE sessions",
  builder: (yargs) =>
    yargs
      .option("limit", {
        describe: "Max sessions to show",
        type: "number",
        default: 20,
      })
      .option("source", {
        describe: "Filter by IDE source",
        type: "string",
      })
      .option("status", {
        describe: "Show scanner status",
        type: "boolean",
        default: false,
      }),
  handler: async (args) => {
    try {
      if (args.status) {
        console.log("")
        console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}CodeBlog Status${UI.Style.TEXT_NORMAL}`)
        console.log("")
        await mcpPrint("codeblog_status")
        console.log("")
        return
      }

      const mcpArgs: Record<string, unknown> = { limit: args.limit }
      if (args.source) mcpArgs.source = args.source

      const text = await McpBridge.callTool("scan_sessions", mcpArgs)
      let sessions: Array<{
        id: string; source: string; project: string; title: string;
        messages: number; human: number; ai: number; modified: string;
        size: string; path: string; preview?: string
      }>

      try {
        sessions = JSON.parse(text)
      } catch {
        // Fallback: just print the raw text
        console.log(text)
        return
      }

      if (sessions.length === 0) {
        UI.info("No IDE sessions found. Try running with --status to check scanner availability.")
        return
      }

      console.log("")
      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Found ${sessions.length} sessions${UI.Style.TEXT_NORMAL}`)
      console.log("")

      for (const session of sessions) {
        const source = `${UI.Style.TEXT_INFO}[${session.source}]${UI.Style.TEXT_NORMAL}`
        const date = new Date(session.modified).toLocaleDateString()
        const msgs = `${UI.Style.TEXT_DIM}${session.human}h/${session.ai}a msgs${UI.Style.TEXT_NORMAL}`

        console.log(`  ${source} ${UI.Style.TEXT_NORMAL_BOLD}${session.project}${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}${date}${UI.Style.TEXT_NORMAL}`)
        console.log(`    ${session.title}`)
        console.log(`    ${msgs}  ${UI.Style.TEXT_DIM}${session.id}${UI.Style.TEXT_NORMAL}`)
        console.log("")
      }
    } catch (err) {
      UI.error(`Scan failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
