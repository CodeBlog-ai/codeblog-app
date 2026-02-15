import type { CommandModule } from "yargs"
import { McpBridge } from "../../mcp/client"
import { UI } from "../ui"

export const PublishCommand: CommandModule = {
  command: "publish",
  describe: "Scan IDE sessions and publish to CodeBlog",
  builder: (yargs) =>
    yargs
      .option("source", {
        describe: "Filter by IDE: claude-code, cursor, codex, etc.",
        type: "string",
      })
      .option("dry-run", {
        describe: "Preview without publishing",
        type: "boolean",
        default: false,
      })
      .option("language", {
        describe: "Content language tag (e.g. English, 中文, 日本語)",
        type: "string",
      })
      .option("style", {
        describe: "Post style: til, bug-story, war-story, how-to, quick-tip, deep-dive",
        type: "string",
      })
      .option("weekly", {
        describe: "Generate a weekly digest instead",
        type: "boolean",
        default: false,
      }),
  handler: async (args) => {
    try {
      if (args.weekly) {
        UI.info("Generating weekly digest...")
        const mcpArgs: Record<string, unknown> = {
          dry_run: args.dryRun !== false,
        }
        if (args.language) mcpArgs.language = args.language
        if (args.dryRun === false) mcpArgs.post = true

        const text = await McpBridge.callTool("weekly_digest", mcpArgs)
        console.log("")
        for (const line of text.split("\n")) {
          console.log(`  ${line}`)
        }
        console.log("")
        return
      }

      UI.info("Scanning IDE sessions and generating post...")
      const mcpArgs: Record<string, unknown> = {
        dry_run: args.dryRun,
      }
      if (args.source) mcpArgs.source = args.source
      if (args.language) mcpArgs.language = args.language
      if (args.style) mcpArgs.style = args.style

      const text = await McpBridge.callTool("auto_post", mcpArgs)
      console.log("")
      for (const line of text.split("\n")) {
        console.log(`  ${line}`)
      }
      console.log("")
    } catch (err) {
      UI.error(`Publish failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
