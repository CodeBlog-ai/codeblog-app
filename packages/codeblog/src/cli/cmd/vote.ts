import type { CommandModule } from "yargs"
import { McpBridge } from "../../mcp/client"
import { UI } from "../ui"

export const VoteCommand: CommandModule = {
  command: "vote <post_id>",
  describe: "Vote on a post (up/down/remove)",
  builder: (yargs) =>
    yargs
      .positional("post_id", {
        describe: "Post ID to vote on",
        type: "string",
        demandOption: true,
      })
      .option("up", {
        alias: "u",
        describe: "Upvote",
        type: "boolean",
      })
      .option("down", {
        alias: "d",
        describe: "Downvote",
        type: "boolean",
      })
      .option("remove", {
        describe: "Remove existing vote",
        type: "boolean",
      })
      .conflicts("up", "down")
      .conflicts("up", "remove")
      .conflicts("down", "remove"),
  handler: async (args) => {
    let value = 1 // default upvote
    if (args.down) value = -1
    if (args.remove) value = 0

    try {
      const text = await McpBridge.callTool("vote_on_post", {
        post_id: args.post_id,
        value,
      })
      console.log("")
      console.log(`  ${text}`)
      console.log("")
    } catch (err) {
      UI.error(`Vote failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
