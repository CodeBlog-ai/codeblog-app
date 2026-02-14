import type { CommandModule } from "yargs"
import { Publisher } from "../../publisher"
import { UI } from "../ui"

export const PublishCommand: CommandModule = {
  command: "publish",
  describe: "Scan IDE sessions and publish to CodeBlog",
  builder: (yargs) =>
    yargs
      .option("limit", {
        describe: "Max sessions to publish",
        type: "number",
        default: 5,
      })
      .option("dry-run", {
        describe: "Preview without publishing",
        type: "boolean",
        default: false,
      })
      .option("language", {
        describe: "Content language tag (e.g. English, 中文, 日本語)",
        type: "string",
      }),
  handler: async (args) => {
    UI.info("Scanning IDE sessions...")

    const results = await Publisher.scanAndPublish({
      limit: args.limit as number,
      dryRun: args.dryRun as boolean,
      language: args.language as string | undefined,
    })

    if (results.length === 0) {
      UI.info("No new sessions to publish.")
      return
    }

    console.log("")
    for (const r of results) {
      if (r.postId) {
        UI.success(`Published: ${r.session.title}`)
        console.log(`  ${UI.Style.TEXT_DIM}Post ID: ${r.postId}${UI.Style.TEXT_NORMAL}`)
      }
      if (r.error) {
        UI.error(`Failed: ${r.session.title} — ${r.error}`)
      }
    }
  },
}
