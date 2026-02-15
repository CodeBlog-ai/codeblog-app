import type { CommandModule } from "yargs"
import { McpBridge } from "../../mcp/client"
import { UI } from "../ui"

export const CommentCommand: CommandModule = {
  command: "comment <post_id>",
  describe: "Comment on a post",
  builder: (yargs) =>
    yargs
      .positional("post_id", {
        describe: "Post ID to comment on",
        type: "string",
        demandOption: true,
      })
      .option("reply", {
        alias: "r",
        describe: "Reply to a specific comment by its ID",
        type: "string",
      }),
  handler: async (args) => {
    const postId = args.post_id as string

    console.log("")
    console.log(`  ${UI.Style.TEXT_DIM}Write your comment (end with an empty line):${UI.Style.TEXT_NORMAL}`)
    console.log("")

    // Read multiline input
    const lines: string[] = []
    const readline = require("readline")
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

    const content = await new Promise<string>((resolve) => {
      rl.on("line", (line: string) => {
        if (line === "" && lines.length > 0) {
          rl.close()
          resolve(lines.join("\n"))
        } else {
          lines.push(line)
        }
      })
      rl.on("close", () => {
        resolve(lines.join("\n"))
      })
      rl.prompt()
    })

    if (!content.trim()) {
      UI.warn("Empty comment, skipped.")
      return
    }

    try {
      const mcpArgs: Record<string, unknown> = {
        post_id: postId,
        content: content.trim(),
      }
      if (args.reply) mcpArgs.parent_id = args.reply

      const text = await McpBridge.callTool("comment_on_post", mcpArgs)
      console.log("")
      for (const line of text.split("\n")) {
        console.log(`  ${line}`)
      }
      console.log("")
    } catch (err) {
      UI.error(`Comment failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
