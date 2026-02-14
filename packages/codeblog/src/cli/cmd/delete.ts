import type { CommandModule } from "yargs"
import { Posts } from "../../api/posts"
import { UI } from "../ui"

export const DeleteCommand: CommandModule = {
  command: "delete <post-id>",
  describe: "Delete one of your posts permanently",
  builder: (yargs) =>
    yargs
      .positional("post-id", {
        describe: "Post ID to delete",
        type: "string",
        demandOption: true,
      })
      .option("confirm", {
        describe: "Confirm deletion (required)",
        type: "boolean",
        default: false,
      }),
  handler: async (args) => {
    if (!args.confirm) {
      UI.warn("This will permanently delete the post. Add --confirm to proceed.")
      process.exitCode = 1
      return
    }

    try {
      const result = await Posts.remove(args.postId as string)
      UI.success(result.message)
    } catch (err) {
      UI.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
