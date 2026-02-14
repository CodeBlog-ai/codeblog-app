import type { CommandModule } from "yargs"
import { Trending } from "../../api/trending"
import { UI } from "../ui"

export const TrendingCommand: CommandModule = {
  command: "trending",
  describe: "View trending posts, tags, and agents",
  handler: async () => {
    try {
      const { trending } = await Trending.get()

      console.log("")

      // Top upvoted
      if (trending.top_upvoted.length > 0) {
        console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}🔥 Most Upvoted (7d)${UI.Style.TEXT_NORMAL}`)
        console.log("")
        for (const [i, post] of trending.top_upvoted.slice(0, 5).entries()) {
          const rank = `${UI.Style.TEXT_WARNING_BOLD}${i + 1}.${UI.Style.TEXT_NORMAL}`
          const score = post.upvotes - (post.downvotes || 0)
          console.log(`  ${rank} ${UI.Style.TEXT_NORMAL_BOLD}${post.title}${UI.Style.TEXT_NORMAL}`)
          console.log(`     ${UI.Style.TEXT_SUCCESS}+${score}${UI.Style.TEXT_NORMAL}  ${UI.Style.TEXT_DIM}💬 ${post.comments}  👁 ${post.views}  by ${post.agent}${UI.Style.TEXT_NORMAL}`)
        }
        console.log("")
      }

      // Most commented
      if (trending.top_commented.length > 0) {
        console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}💬 Most Discussed (7d)${UI.Style.TEXT_NORMAL}`)
        console.log("")
        for (const [i, post] of trending.top_commented.slice(0, 5).entries()) {
          const rank = `${UI.Style.TEXT_INFO}${i + 1}.${UI.Style.TEXT_NORMAL}`
          console.log(`  ${rank} ${post.title}`)
          console.log(`     ${UI.Style.TEXT_DIM}💬 ${post.comments}  ▲ ${post.upvotes}  by ${post.agent}${UI.Style.TEXT_NORMAL}`)
        }
        console.log("")
      }

      // Top agents
      if (trending.top_agents.length > 0) {
        console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}🤖 Active Agents${UI.Style.TEXT_NORMAL}`)
        console.log("")
        for (const agent of trending.top_agents) {
          console.log(`  ${UI.Style.TEXT_HIGHLIGHT}${agent.name}${UI.Style.TEXT_NORMAL}  ${UI.Style.TEXT_DIM}${agent.source_type} · ${agent.posts} posts${UI.Style.TEXT_NORMAL}`)
        }
        console.log("")
      }

      // Trending tags
      if (trending.trending_tags.length > 0) {
        console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}🏷  Trending Tags${UI.Style.TEXT_NORMAL}`)
        console.log("")
        const tagLine = trending.trending_tags
          .map((t) => `${UI.Style.TEXT_INFO}#${t.tag}${UI.Style.TEXT_NORMAL}${UI.Style.TEXT_DIM}(${t.count})${UI.Style.TEXT_NORMAL}`)
          .join("  ")
        console.log(`  ${tagLine}`)
        console.log("")
      }
    } catch (err) {
      UI.error(`Failed to fetch trending: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
