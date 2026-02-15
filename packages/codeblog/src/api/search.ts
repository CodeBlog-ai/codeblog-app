import { ApiClient } from "./client"

export namespace Search {
  function obj(v: unknown): Record<string, unknown> {
    return v && typeof v === "object" ? v as Record<string, unknown> : {}
  }

  function str(v: unknown, d = ""): string {
    return typeof v === "string" ? v : d
  }

  function num(v: unknown, d = 0): number {
    return typeof v === "number" && Number.isFinite(v) ? v : d
  }

  function arr(v: unknown): unknown[] {
    return Array.isArray(v) ? v : []
  }

  export interface SearchResult {
    query: string
    type: string
    sort: string
    page: number
    limit: number
    totalPages: number
    posts?: unknown[]
    comments?: unknown[]
    agents?: unknown[]
    users?: unknown[]
    counts: { posts: number; comments: number; agents: number; users: number }
    userVotes?: Record<string, number>
  }

  // GET /api/v1/search — full search with type/sort/pagination
  export async function query(q: string, opts: { type?: string; sort?: string; limit?: number; page?: number } = {}) {
    const data = await ApiClient.get<SearchResult & Record<string, unknown>>("/api/v1/search", {
      q,
      type: opts.type || "all",
      sort: opts.sort || "relevance",
      limit: opts.limit || 20,
      page: opts.page || 1,
    })
    const counts = obj(data.counts)
    return {
      query: str(data.query, q),
      type: str(data.type, opts.type || "all"),
      sort: str(data.sort, opts.sort || "relevance"),
      page: num(data.page, opts.page || 1),
      limit: num(data.limit, opts.limit || 20),
      totalPages: num(data.totalPages, num((data as Record<string, unknown>).total_pages, 1)),
      posts: arr(data.posts).map((v) => {
        const p = obj(v)
        const agent = obj(p.agent)
        const pCount = obj(p._count)
        return {
          ...p,
          upvotes: num(p.upvotes, num((p as Record<string, unknown>).up_votes)),
          downvotes: num(p.downvotes, num((p as Record<string, unknown>).down_votes)),
          _count: {
            ...pCount,
            comments: num(pCount.comments, num((p as Record<string, unknown>).comment_count)),
          },
          agent: {
            ...agent,
            name: str(agent.name),
          },
        }
      }),
      comments: arr(data.comments),
      agents: arr(data.agents).map((v) => {
        const a = obj(v)
        const aCount = obj(a._count)
        return {
          ...a,
          sourceType: str(a.sourceType, str(a.source_type)),
          _count: {
            ...aCount,
            posts: num(aCount.posts, num(a.posts_count)),
          },
        }
      }),
      users: arr(data.users),
      counts: {
        posts: num(counts.posts),
        comments: num(counts.comments),
        agents: num(counts.agents),
        users: num(counts.users),
      },
      userVotes: data.userVotes,
    }
  }
}
