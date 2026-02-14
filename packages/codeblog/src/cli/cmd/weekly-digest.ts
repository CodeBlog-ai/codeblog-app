import type { CommandModule } from "yargs"
import { scanAll, parseSession, registerAllScanners } from "../../scanner"
import { analyzeSession } from "../../scanner/analyzer"
import { Posts } from "../../api/posts"
import { UI } from "../ui"

export const WeeklyDigestCommand: CommandModule = {
  command: "weekly-digest",
  aliases: ["digest"],
  describe: "Generate a weekly coding digest from your IDE sessions",
  builder: (yargs) =>
    yargs
      .option("post", {
        describe: "Auto-post the digest to CodeBlog",
        type: "boolean",
        default: false,
      })
      .option("dry-run", {
        describe: "Preview without posting (default)",
        type: "boolean",
        default: true,
      }),
  handler: async (args) => {
    try {
      registerAllScanners()
      const sessions = scanAll(50)
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const recent = sessions.filter((s) => s.modifiedAt >= cutoff)

      if (recent.length === 0) {
        UI.warn("No coding sessions found in the last 7 days.")
        return
      }

      const languages = new Set<string>()
      const topics = new Set<string>()
      const tags = new Set<string>()
      const problems: string[] = []
      const insights: string[] = []
      const projects = new Set<string>()
      const sources = new Set<string>()
      let turns = 0

      for (const session of recent) {
        projects.add(session.project)
        sources.add(session.source)
        turns += session.messageCount
        const parsed = parseSession(session.filePath, session.source, 30)
        if (!parsed || parsed.turns.length === 0) continue
        const analysis = analyzeSession(parsed)
        analysis.languages.forEach((l) => languages.add(l))
        analysis.topics.forEach((t) => topics.add(t))
        analysis.suggestedTags.forEach((t) => tags.add(t))
        problems.push(...analysis.problems.slice(0, 2))
        insights.push(...analysis.keyInsights.slice(0, 2))
      }

      const projectArr = [...projects]
      const langArr = [...languages]

      let digest = `## This Week in Code\n\n`
      digest += `*${recent.length} sessions across ${projectArr.length} project${projectArr.length > 1 ? "s" : ""}*\n\n`
      digest += `### Overview\n`
      digest += `- **Sessions:** ${recent.length}\n`
      digest += `- **Total messages:** ${turns}\n`
      digest += `- **Projects:** ${projectArr.slice(0, 5).join(", ")}\n`
      digest += `- **IDEs:** ${[...sources].join(", ")}\n`
      if (langArr.length > 0) digest += `- **Languages:** ${langArr.join(", ")}\n`
      if (topics.size > 0) digest += `- **Topics:** ${[...topics].join(", ")}\n`
      digest += `\n`

      if (problems.length > 0) {
        digest += `### Problems Tackled\n`
        for (const p of [...new Set(problems)].slice(0, 5)) digest += `- ${p.slice(0, 150)}\n`
        digest += `\n`
      }

      if (insights.length > 0) {
        digest += `### Key Insights\n`
        for (const i of [...new Set(insights)].slice(0, 5)) digest += `- ${i.slice(0, 150)}\n`
        digest += `\n`
      }

      digest += `---\n\n*Weekly digest generated from ${[...sources].join(", ")} sessions*\n`

      const title = `Weekly Digest: ${projectArr.slice(0, 2).join(" & ")} — ${langArr.slice(0, 3).join(", ") || "coding"} week`

      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Title:${UI.Style.TEXT_NORMAL} ${title}`)
      console.log(`  ${UI.Style.TEXT_DIM}Tags: ${[...tags].slice(0, 8).join(", ")}${UI.Style.TEXT_NORMAL}`)
      console.log("")
      console.log(digest)

      if (args.post && !args.dryRun) {
        UI.info("Publishing digest to CodeBlog...")
        const post = await Posts.create({
          title: title.slice(0, 80),
          content: digest,
          tags: [...tags].slice(0, 8),
          summary: `${recent.length} sessions, ${projectArr.length} projects, ${langArr.length} languages this week`,
          source_session: recent[0].filePath,
        })
        UI.success(`Published! Post ID: ${post.post.id}`)
      } else {
        console.log(`  ${UI.Style.TEXT_DIM}Use --post --no-dry-run to publish this digest.${UI.Style.TEXT_NORMAL}`)
      }
    } catch (err) {
      UI.error(`Weekly digest failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
