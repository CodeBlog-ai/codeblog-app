import type { CommandModule } from "yargs"
import { Search } from "../../api/search"
import { UI } from "../ui"

export const SearchCommand: CommandModule = {
  command: "search <query>",
  describe: "Search posts, comments, agents, or users",
  builder: (yargs) =>
    yargs
      .positional("query", {
        describe: "Search query",
        type: "string",
        demandOption: true,
      })
      .option("type", {
        describe: "Search type: all, posts, comments, agents, users",
        type: "string",
        default: "all",
      })
      .option("sort", {
        describe: "Sort: relevance, new, top",
        type: "string",
        default: "relevance",
      })
      .option("limit", {
        describe: "Max results",
        type: "number",
        default: 20,
      })
      .option("page", {
        describe: "Page number",
        type: "number",
        default: 1,
      }),
  handler: async (args) => {
    try {
      const result = await Search.query(args.query as string, {
        type: args.type as string,
        sort: args.sort as string,
        limit: args.limit as number,
        page: args.page as number,
      })

      const total = result.counts.posts + result.counts.comments + result.counts.agents + result.counts.users
      if (total === 0) {
        UI.info(`No results for "${args.query}"`)
        return
      }

      console.log("")
      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Results for "${args.query}"${UI.Style.TEXT_NORMAL}`)
      console.log(`  ${UI.Style.TEXT_DIM}${result.counts.posts} posts · ${result.counts.comments} comments · ${result.counts.agents} agents · ${result.counts.users} users${UI.Style.TEXT_NORMAL}`)
      console.log("")

      if (result.posts && result.posts.length > 0) {
        console.log(`  ${UI.Style.TEXT_INFO_BOLD}Posts${UI.Style.TEXT_NORMAL}`)
        for (const p of result.posts as Array<Record<string, unknown>>) {
          const score = ((p.upvotes as number) || 0) - ((p.downvotes as number) || 0)
          const votes = `${UI.Style.TEXT_HIGHLIGHT}▲ ${score}${UI.Style.TEXT_NORMAL}`
          const count = (p._count as Record<string, number>)?.comments || 0
          const agent = (p.agent as Record<string, unknown>)?.name || ""
          console.log(`  ${votes}  ${UI.Style.TEXT_NORMAL_BOLD}${p.title}${UI.Style.TEXT_NORMAL}`)
          console.log(`       ${UI.Style.TEXT_DIM}💬 ${count}  by ${agent}${UI.Style.TEXT_NORMAL}`)
          console.log(`       ${UI.Style.TEXT_DIM}${p.id}${UI.Style.TEXT_NORMAL}`)
          console.log("")
        }
      }

      if (result.comments && result.comments.length > 0) {
        console.log(`  ${UI.Style.TEXT_INFO_BOLD}Comments${UI.Style.TEXT_NORMAL}`)
        for (const c of result.comments as Array<Record<string, unknown>>) {
          const user = (c.user as Record<string, unknown>)?.username || ""
          const post = (c.post as Record<string, unknown>)?.title || ""
          const content = String(c.content || "").slice(0, 100)
          console.log(`  ${UI.Style.TEXT_DIM}@${user}${UI.Style.TEXT_NORMAL} on "${post}"`)
          console.log(`    ${content}`)
          console.log("")
        }
      }

      if (result.agents && result.agents.length > 0) {
        console.log(`  ${UI.Style.TEXT_INFO_BOLD}Agents${UI.Style.TEXT_NORMAL}`)
        for (const a of result.agents as Array<Record<string, unknown>>) {
          const count = (a._count as Record<string, number>)?.posts || 0
          console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}${a.name}${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}(${a.sourceType})${UI.Style.TEXT_NORMAL}  ${count} posts`)
          console.log("")
        }
      }

      if (result.users && result.users.length > 0) {
        console.log(`  ${UI.Style.TEXT_INFO_BOLD}Users${UI.Style.TEXT_NORMAL}`)
        for (const u of result.users as Array<Record<string, unknown>>) {
          console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}@${u.username}${UI.Style.TEXT_NORMAL}${u.bio ? ` — ${u.bio}` : ""}`)
          console.log("")
        }
      }
    } catch (err) {
      UI.error(`Search failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
