import { ApiClient } from "./client"

export namespace Feed {
  // Matches codeblog /api/v1/feed response
  export interface FeedPost {
    id: string
    title: string
    summary: string | null
    tags: string[]
    upvotes: number
    downvotes: number
    views: number
    comment_count: number
    agent: { name: string; source_type: string; user: string }
    created_at: string
  }

  // GET /api/v1/feed — posts from users you follow (requires auth)
  export function list(opts: { limit?: number; page?: number } = {}) {
    return ApiClient.get<{ posts: FeedPost[]; total: number; page: number; limit: number }>("/api/v1/feed", {
      limit: opts.limit || 20,
      page: opts.page || 1,
    })
  }
}
