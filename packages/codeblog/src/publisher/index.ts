import { scanAll, parseSession, analyzeSession, registerAllScanners } from "../scanner"
import { Posts } from "../api/posts"
import { Database } from "../storage/db"
import { published_sessions } from "../storage/schema.sql"
import { eq } from "drizzle-orm"
import { Log } from "../util/log"
import type { Session } from "../scanner/types"

const log = Log.create({ service: "publisher" })

export namespace Publisher {
  export async function scanAndPublish(options: { limit?: number; dryRun?: boolean } = {}) {
    registerAllScanners()
    const limit = options.limit || 10
    const sessions = scanAll(limit)

    log.info("scanned sessions", { count: sessions.length })

    const unpublished = await filterUnpublished(sessions)
    log.info("unpublished sessions", { count: unpublished.length })

    if (unpublished.length === 0) {
      console.log("No new sessions to publish.")
      return []
    }

    const results: Array<{ session: Session; postId?: string; error?: string }> = []

    for (const session of unpublished) {
      try {
        const parsed = parseSession(session.filePath, session.source, 50)
        if (!parsed || parsed.turns.length < 4) {
          log.debug("skipping session with too few turns", { id: session.id })
          continue
        }

        const analysis = analyzeSession(parsed)

        if (options.dryRun) {
          console.log(`\n[DRY RUN] Would publish:`)
          console.log(`  Title: ${analysis.suggestedTitle}`)
          console.log(`  Tags: ${analysis.suggestedTags.join(", ")}`)
          console.log(`  Summary: ${analysis.summary}`)
          results.push({ session })
          continue
        }

        const content = formatPost(analysis)
        const result = await Posts.create({
          title: analysis.suggestedTitle,
          content,
          tags: analysis.suggestedTags,
        })

        await markPublished(session, result.post.id)
        log.info("published", { sessionId: session.id, postId: result.post.id })
        results.push({ session, postId: result.post.id })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        log.error("publish failed", { sessionId: session.id, error: msg })
        results.push({ session, error: msg })
      }
    }

    return results
  }

  async function filterUnpublished(sessions: Session[]): Promise<Session[]> {
    const db = Database.Client()
    const published = db.select().from(published_sessions).all()
    const publishedIds = new Set(published.map((p) => p.session_id))
    return sessions.filter((s) => !publishedIds.has(s.id))
  }

  async function markPublished(session: Session, postId: string) {
    const db = Database.Client()
    db.insert(published_sessions)
      .values({
        id: `${session.source}:${session.id}`,
        session_id: session.id,
        source: session.source,
        post_id: postId,
        file_path: session.filePath,
      })
      .run()
  }

  function formatPost(analysis: ReturnType<typeof analyzeSession>): string {
    const parts: string[] = []

    parts.push(analysis.summary)
    parts.push("")

    if (analysis.languages.length > 0) {
      parts.push(`**Languages:** ${analysis.languages.join(", ")}`)
      parts.push("")
    }

    if (analysis.problems.length > 0) {
      parts.push("## Problems Encountered")
      for (const problem of analysis.problems) {
        parts.push(`- ${problem}`)
      }
      parts.push("")
    }

    if (analysis.solutions.length > 0) {
      parts.push("## Solutions")
      for (const solution of analysis.solutions) {
        parts.push(`- ${solution}`)
      }
      parts.push("")
    }

    if (analysis.keyInsights.length > 0) {
      parts.push("## Key Insights")
      for (const insight of analysis.keyInsights) {
        parts.push(`- ${insight}`)
      }
      parts.push("")
    }

    if (analysis.codeSnippets.length > 0) {
      parts.push("## Code Highlights")
      for (const snippet of analysis.codeSnippets.slice(0, 3)) {
        if (snippet.context) parts.push(snippet.context)
        parts.push(`\`\`\`${snippet.language}`)
        parts.push(snippet.code)
        parts.push("```")
        parts.push("")
      }
    }

    return parts.join("\n")
  }
}
