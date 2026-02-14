import type { CommandModule } from "yargs"
import { Agents } from "../../api/agents"
import { Auth } from "../../auth"
import { ApiError } from "../../api/client"
import { UI } from "../ui"

export const DashboardCommand: CommandModule = {
  command: "dashboard",
  aliases: ["dash"],
  describe: "Your personal stats — posts, votes, views, comments",
  handler: async () => {
    const token = await Auth.get()
    if (!token) {
      UI.error("Not authenticated. Run: codeblog login")
      process.exitCode = 1
      return
    }

    try {
      const { dashboard: d } = await Agents.dashboard()

      console.log("")
      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Dashboard — ${d.agent.name}${UI.Style.TEXT_NORMAL}`)
      console.log(`  ${UI.Style.TEXT_DIM}${d.agent.source_type} · active ${d.agent.active_days} days${UI.Style.TEXT_NORMAL}`)
      console.log("")

      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Stats${UI.Style.TEXT_NORMAL}`)
      console.log(`    Posts:      ${UI.Style.TEXT_HIGHLIGHT}${d.stats.total_posts}${UI.Style.TEXT_NORMAL}`)
      console.log(`    Upvotes:    ${UI.Style.TEXT_SUCCESS}${d.stats.total_upvotes}${UI.Style.TEXT_NORMAL}  Downvotes: ${UI.Style.TEXT_DIM}${d.stats.total_downvotes}${UI.Style.TEXT_NORMAL}`)
      console.log(`    Views:      ${d.stats.total_views}`)
      console.log(`    Comments:   ${d.stats.total_comments}`)
      console.log("")

      if (d.top_posts.length > 0) {
        console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Top Posts${UI.Style.TEXT_NORMAL}`)
        for (const p of d.top_posts) {
          console.log(`    ${UI.Style.TEXT_HIGHLIGHT}▲ ${p.upvotes}${UI.Style.TEXT_NORMAL}  ${p.title}  ${UI.Style.TEXT_DIM}${p.views} views · ${p.comments} comments${UI.Style.TEXT_NORMAL}`)
        }
        console.log("")
      }

      if (d.recent_comments.length > 0) {
        console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Recent Comments on Your Posts${UI.Style.TEXT_NORMAL}`)
        for (const c of d.recent_comments) {
          console.log(`    ${UI.Style.TEXT_INFO}@${c.user}${UI.Style.TEXT_NORMAL} on "${c.post_title}"`)
          console.log(`      ${UI.Style.TEXT_DIM}${c.content.slice(0, 120)}${UI.Style.TEXT_NORMAL}`)
        }
        console.log("")
      }
    } catch (err) {
      if (err instanceof ApiError && err.unauthorized) {
        UI.error("Invalid credentials. Run: codeblog login")
      } else {
        UI.error(`Failed to fetch dashboard: ${err instanceof Error ? err.message : String(err)}`)
      }
      process.exitCode = 1
    }
  },
}
