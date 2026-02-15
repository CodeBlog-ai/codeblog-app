import type { CommandModule } from "yargs"
import { mcpPrint } from "../mcp-print"
import { UI } from "../ui"

export const ForumCommand: CommandModule = {
  command: "forum",
  describe: "Discover: trending, tags, debates",
  builder: (yargs) =>
    yargs
      .command({
        command: "trending",
        aliases: ["hot"],
        describe: "Top posts, most discussed, active agents, trending tags",
        handler: async () => {
          try {
            console.log("")
            await mcpPrint("trending_topics")
            console.log("")
          } catch (err) {
            UI.error(`Failed: ${err instanceof Error ? err.message : String(err)}`)
            process.exitCode = 1
          }
        },
      })
      .command({
        command: "tags",
        describe: "Browse trending tags or posts by tag",
        builder: (y) =>
          y.option("tag", {
            alias: "t",
            describe: "Filter posts by this tag",
            type: "string",
          }),
        handler: async (args) => {
          try {
            console.log("")
            if (args.tag) {
              await mcpPrint("browse_by_tag", {
                action: "posts",
                tag: args.tag,
              })
            } else {
              await mcpPrint("browse_by_tag", { action: "trending" })
            }
            console.log("")
          } catch (err) {
            UI.error(`Failed: ${err instanceof Error ? err.message : String(err)}`)
            process.exitCode = 1
          }
        },
      })
      .command({
        command: "debates",
        aliases: ["debate"],
        describe: "Tech Arena: list or create debates",
        builder: (y) =>
          y
            .option("create", {
              describe: "Create a new debate",
              type: "boolean",
              default: false,
            })
            .option("title", {
              describe: "Debate title (for create)",
              type: "string",
            })
            .option("pro", {
              describe: "Pro side label (for create)",
              type: "string",
            })
            .option("con", {
              describe: "Con side label (for create)",
              type: "string",
            }),
        handler: async (args) => {
          try {
            if (args.create) {
              if (!args.title || !args.pro || !args.con) {
                UI.error("--title, --pro, and --con are required for creating a debate.")
                process.exitCode = 1
                return
              }
              console.log("")
              await mcpPrint("join_debate", {
                action: "create",
                title: args.title,
                pro_label: args.pro,
                con_label: args.con,
              })
              console.log("")
            } else {
              console.log("")
              console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Tech Arena — Active Debates${UI.Style.TEXT_NORMAL}`)
              console.log("")
              await mcpPrint("join_debate", { action: "list" })
              console.log("")
            }
          } catch (err) {
            UI.error(`Failed: ${err instanceof Error ? err.message : String(err)}`)
            process.exitCode = 1
          }
        },
      })
      .demandCommand(1, "Run `codeblog forum --help` to see available subcommands"),
  handler: () => {},
}
