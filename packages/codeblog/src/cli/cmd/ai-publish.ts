import type { CommandModule } from "yargs"
import { AIChat } from "../../ai/chat"
import { AIProvider } from "../../ai/provider"
import { Posts } from "../../api/posts"
import { Config } from "../../config"
import { scanAll, parseSession, registerAllScanners } from "../../scanner"
import { UI } from "../ui"

export const AIPublishCommand: CommandModule = {
  command: "ai-publish",
  aliases: ["ap"],
  describe: "AI-powered publish — scan sessions, let AI write the post",
  builder: (yargs) =>
    yargs
      .option("model", {
        alias: "m",
        describe: "AI model to use",
        type: "string",
      })
      .option("dry-run", {
        describe: "Preview without publishing",
        type: "boolean",
        default: false,
      })
      .option("limit", {
        describe: "Max sessions to scan",
        type: "number",
        default: 10,
      })
      .option("language", {
        describe: "Content language tag (e.g. English, 中文, 日本語)",
        type: "string",
      }),
  handler: async (args) => {
    try {
      // Check AI key before scanning
      const hasKey = await AIProvider.hasAnyKey()
      if (!hasKey) {
        console.log("")
        UI.warn("No AI provider configured. ai-publish requires an AI API key to generate posts.")
        console.log("")
        console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Configure an AI provider first:${UI.Style.TEXT_NORMAL}`)
        console.log(`    ${UI.Style.TEXT_HIGHLIGHT}codeblog config --provider anthropic --api-key sk-ant-...${UI.Style.TEXT_NORMAL}`)
        console.log("")
        console.log(`  ${UI.Style.TEXT_DIM}Run: codeblog config --list  to see all supported providers${UI.Style.TEXT_NORMAL}`)
        console.log("")
        process.exitCode = 1
        return
      }

      UI.info("Scanning IDE sessions...")
      registerAllScanners()
      const sessions = scanAll(args.limit as number)

      if (sessions.length === 0) {
        UI.warn("No IDE sessions found.")
        return
      }

      console.log(`  Found ${UI.Style.TEXT_HIGHLIGHT}${sessions.length}${UI.Style.TEXT_NORMAL} sessions`)
      console.log("")

      // Pick the best session
      const best = sessions[0]
      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Selected:${UI.Style.TEXT_NORMAL} ${best.title}`)
      console.log(`  ${UI.Style.TEXT_DIM}${best.source} · ${best.project}${UI.Style.TEXT_NORMAL}`)
      console.log("")

      // Parse session content
      const parsed = parseSession(best.filePath, best.source, 50)
      if (!parsed || parsed.turns.length < 2) {
        UI.warn("Session too short to generate a post.")
        return
      }

      const content = parsed.turns
        .map((t) => `[${t.role}]: ${t.content.slice(0, 2000)}`)
        .join("\n\n")

      UI.info("AI is writing your post...")
      console.log("")

      process.stdout.write(`  ${UI.Style.TEXT_DIM}`)
      const result = await AIChat.analyzeAndPost(content, args.model as string | undefined)
      process.stdout.write(UI.Style.TEXT_NORMAL)

      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Title:${UI.Style.TEXT_NORMAL} ${result.title}`)
      console.log(`  ${UI.Style.TEXT_DIM}Tags: ${result.tags.join(", ")}${UI.Style.TEXT_NORMAL}`)
      console.log(`  ${UI.Style.TEXT_DIM}Summary: ${result.summary}${UI.Style.TEXT_NORMAL}`)
      console.log("")

      if (args.dryRun) {
        console.log(`  ${UI.Style.TEXT_WARNING}[DRY RUN]${UI.Style.TEXT_NORMAL} Preview:`)
        console.log("")
        console.log(result.content.slice(0, 1000))
        if (result.content.length > 1000) console.log(`  ${UI.Style.TEXT_DIM}... (${result.content.length} chars total)${UI.Style.TEXT_NORMAL}`)
        console.log("")
        return
      }

      UI.info("Publishing to CodeBlog...")
      const lang = (args.language as string) || await Config.language()
      const post = await Posts.create({
        title: result.title,
        content: result.content,
        tags: result.tags,
        summary: result.summary,
        source_session: best.filePath,
        ...(lang ? { language: lang } : {}),
      })

      UI.success(`Published! Post ID: ${post.post.id}`)
    } catch (err) {
      UI.error(`AI publish failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
