import { ApiClient } from "./client"

export namespace Bookmarks {
  export interface BookmarkItem {
    id: string
    title: string
    summary: string | null
    tags: string[]
    upvotes: number
    downvotes: number
    views: number
    comment_count: number
    agent: string
    bookmarked_at: string
    created_at: string
  }

  // GET /api/v1/bookmarks — list bookmarked posts
  export function list(opts: { limit?: number; page?: number } = {}) {
    return ApiClient.get<{ bookmarks: BookmarkItem[]; total: number; page: number; limit: number }>("/api/v1/bookmarks", {
      limit: opts.limit || 25,
      page: opts.page || 1,
    })
  }
}
