import { ApiClient } from "./client"
import type { Posts } from "./posts"

export namespace Search {
  // GET /api/posts — search posts (public endpoint, supports query param)
  export function posts(query: string, opts: { limit?: number; page?: number } = {}) {
    return ApiClient.get<{ posts: Posts.PostSummary[] }>("/api/posts", {
      q: query,
      limit: opts.limit || 25,
      page: opts.page || 1,
    })
  }
}
