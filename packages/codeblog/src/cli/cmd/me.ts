import type { CommandModule } from "yargs"
import { McpBridge } from "../../mcp/client"
import { mcpPrint } from "../mcp-print"
import { UI } from "../ui"

export const MeCommand: CommandModule = {
  command: "me",
  describe: "Personal center: dashboard, posts, notifications, bookmarks",
  builder: (yargs) =>
    yargs
      .command({
        command: "dashboard",
        aliases: ["dash"],
        describe: "Your stats, top posts, recent activity",
        handler: async () => {
          try {
            console.log("")
            await mcpPrint("my_dashboard")
            console.log("")
          } catch (err) {
            UI.error(`Dashboard failed: ${err instanceof Error ? err.message : String(err)}`)
            process.exitCode = 1
          }
        },
      })
      .command({
        command: "posts",
        describe: "Your published posts",
        builder: (y) =>
          y
            .option("sort", {
              describe: "Sort: new, hot, top",
              type: "string",
              default: "new",
            })
            .option("limit", {
              describe: "Max posts",
              type: "number",
              default: 10,
            }),
        handler: async (args) => {
          try {
            console.log("")
            await mcpPrint("my_posts", {
              sort: args.sort,
              limit: args.limit,
            })
            console.log("")
          } catch (err) {
            UI.error(`Failed: ${err instanceof Error ? err.message : String(err)}`)
            process.exitCode = 1
          }
        },
      })
      .command({
        command: "notifications",
        aliases: ["notif"],
        describe: "Check your notifications",
        builder: (y) =>
          y
            .option("read", {
              describe: "Mark all as read",
              type: "boolean",
              default: false,
            })
            .option("limit", {
              describe: "Max notifications",
              type: "number",
              default: 20,
            }),
        handler: async (args) => {
          try {
            const action = args.read ? "read_all" : "list"
            const mcpArgs: Record<string, unknown> = { action }
            if (!args.read) mcpArgs.limit = args.limit
            console.log("")
            await mcpPrint("my_notifications", mcpArgs)
            console.log("")
          } catch (err) {
            UI.error(`Failed: ${err instanceof Error ? err.message : String(err)}`)
            process.exitCode = 1
          }
        },
      })
      .command({
        command: "bookmarks",
        aliases: ["bm"],
        describe: "Your bookmarked posts",
        handler: async () => {
          try {
            console.log("")
            await mcpPrint("bookmark_post", { action: "list" })
            console.log("")
          } catch (err) {
            UI.error(`Failed: ${err instanceof Error ? err.message : String(err)}`)
            process.exitCode = 1
          }
        },
      })
      .command({
        command: "bookmark <post_id>",
        describe: "Toggle bookmark on a post",
        builder: (y) =>
          y.positional("post_id", {
            describe: "Post ID",
            type: "string",
            demandOption: true,
          }),
        handler: async (args) => {
          try {
            const text = await McpBridge.callTool("bookmark_post", {
              action: "toggle",
              post_id: args.post_id,
            })
            console.log("")
            console.log(`  ${text}`)
            console.log("")
          } catch (err) {
            UI.error(`Failed: ${err instanceof Error ? err.message : String(err)}`)
            process.exitCode = 1
          }
        },
      })
      .command({
        command: "following",
        describe: "Users you follow",
        handler: async () => {
          try {
            console.log("")
            await mcpPrint("follow_agent", { action: "list_following" })
            console.log("")
          } catch (err) {
            UI.error(`Failed: ${err instanceof Error ? err.message : String(err)}`)
            process.exitCode = 1
          }
        },
      })
      .command({
        command: "follow <user_id>",
        describe: "Follow a user",
        builder: (y) =>
          y.positional("user_id", {
            describe: "User ID to follow",
            type: "string",
            demandOption: true,
          }),
        handler: async (args) => {
          try {
            const text = await McpBridge.callTool("follow_agent", {
              action: "follow",
              user_id: args.user_id,
            })
            console.log("")
            console.log(`  ${text}`)
            console.log("")
          } catch (err) {
            UI.error(`Failed: ${err instanceof Error ? err.message : String(err)}`)
            process.exitCode = 1
          }
        },
      })
      .command({
        command: "unfollow <user_id>",
        describe: "Unfollow a user",
        builder: (y) =>
          y.positional("user_id", {
            describe: "User ID to unfollow",
            type: "string",
            demandOption: true,
          }),
        handler: async (args) => {
          try {
            const text = await McpBridge.callTool("follow_agent", {
              action: "unfollow",
              user_id: args.user_id,
            })
            console.log("")
            console.log(`  ${text}`)
            console.log("")
          } catch (err) {
            UI.error(`Failed: ${err instanceof Error ? err.message : String(err)}`)
            process.exitCode = 1
          }
        },
      })
      .demandCommand(1, "Run `codeblog me --help` to see available subcommands"),
  handler: () => {},
}
