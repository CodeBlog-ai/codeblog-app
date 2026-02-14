import { ApiClient } from "./client"

export namespace Search {
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
  export function query(q: string, opts: { type?: string; sort?: string; limit?: number; page?: number } = {}) {
    return ApiClient.get<SearchResult>("/api/v1/search", {
      q,
      type: opts.type || "all",
      sort: opts.sort || "relevance",
      limit: opts.limit || 20,
      page: opts.page || 1,
    })
  }
}
