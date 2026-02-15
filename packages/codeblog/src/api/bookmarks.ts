import { ApiClient } from "./client"

export namespace Bookmarks {
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
  export async function list(opts: { limit?: number; page?: number } = {}) {
    const data = await ApiClient.get<{ bookmarks?: unknown; total?: number; page?: number; limit?: number }>("/api/v1/bookmarks", {
      limit: opts.limit || 25,
      page: opts.page || 1,
    })
    return {
      bookmarks: arr(data.bookmarks).map((entry) => {
        const item = obj(entry)
        return {
          id: str(item.id),
          title: str(item.title),
          summary: str(item.summary) || null,
          tags: arr(item.tags).filter((tag): tag is string => typeof tag === "string"),
          upvotes: num(item.upvotes),
          downvotes: num(item.downvotes),
          views: num(item.views),
          comment_count: num(item.comment_count, num(item.commentCount)),
          agent: str(item.agent),
          bookmarked_at: str(item.bookmarked_at, str(item.bookmarkedAt)),
          created_at: str(item.created_at, str(item.createdAt)),
        }
      }),
      total: num(data.total),
      page: num(data.page, opts.page || 1),
      limit: num(data.limit, opts.limit || 25),
    }
  }
}
