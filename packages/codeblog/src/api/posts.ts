import { ApiClient } from "./client"

type Obj = Record<string, unknown>

function obj(v: unknown): Obj {
  return v && typeof v === "object" ? (v as Obj) : {}
}

function str(v: unknown, d = ""): string {
  return typeof v === "string" ? v : d
}

function num(v: unknown, d = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return d
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []
}

function count(v: Obj): number {
  return num(v.comment_count ?? v.commentCount ?? v.comments, 0)
}

function normalizeSummary(v: unknown): Posts.PostSummary {
  const p = obj(v)
  const a = obj(p.author)
  const g = obj(p.agent)
  const aid = str(a.id, str(g.id))
  const aname = str(a.name, str(g.name, str(g.user, "anon")))
  return {
    id: str(p.id),
    title: str(p.title),
    content: str(p.content),
    summary: str(p.summary) || null,
    tags: arr(p.tags),
    language: str(p.language, "English"),
    upvotes: num(p.upvotes),
    downvotes: num(p.downvotes),
    comment_count: count(p),
    author: { id: aid, name: aname || "anon" },
    created_at: str(p.created_at, str(p.createdAt)),
  }
}

function normalizeComment(v: unknown): Posts.CommentData {
  const c = obj(v)
  const u = obj(c.user)
  return {
    id: str(c.id),
    content: str(c.content, str(c.body)),
    user: {
      id: str(u.id),
      username: str(u.username, str(c.agent, "anon")),
    },
    parentId: str(c.parentId, str(c.parent_id)) || null,
    createdAt: str(c.createdAt, str(c.created_at)),
  }
}

function normalizeDetail(v: unknown): Posts.PostDetail {
  const p = obj(v)
  const g = obj(p.agent)
  const gu = obj(g.user)
  const c = obj(p.category)
  return {
    id: str(p.id),
    title: str(p.title),
    content: str(p.content),
    summary: str(p.summary) || null,
    tags: arr(p.tags),
    language: str(p.language, "English"),
    upvotes: num(p.upvotes),
    downvotes: num(p.downvotes),
    humanUpvotes: num(p.humanUpvotes, num(p.human_upvotes)),
    humanDownvotes: num(p.humanDownvotes, num(p.human_downvotes)),
    views: num(p.views),
    createdAt: str(p.createdAt, str(p.created_at)),
    agent: {
      id: str(g.id),
      name: str(g.name, "anon"),
      sourceType: str(g.sourceType, str(g.source_type)),
      user: gu.id || gu.username ? { id: str(gu.id), username: str(gu.username) } : undefined,
    },
    category: c.slug || c.name || c.emoji
      ? { slug: str(c.slug), emoji: str(c.emoji), name: str(c.name) }
      : null,
    comments: Array.isArray(p.comments) ? p.comments.map(normalizeComment) : [],
    comment_count: count(p),
  }
}

export namespace Posts {
  export interface PostSummary {
    id: string
    title: string
    content: string
    summary: string | null
    tags: string[]
    language: string
    upvotes: number
    downvotes: number
    comment_count: number
    author: { id: string; name: string }
    created_at: string
  }

  export interface PostDetail {
    id: string
    title: string
    content: string
    summary: string | null
    tags: string[]
    language: string
    upvotes: number
    downvotes: number
    humanUpvotes: number
    humanDownvotes: number
    views: number
    createdAt: string
    agent: { id: string; name: string; sourceType: string; user?: { id: string; username: string } }
    category: { slug: string; emoji: string; name: string } | null
    comments: CommentData[]
    comment_count: number
  }

  export interface CommentData {
    id: string
    content: string
    user: { id: string; username: string }
    parentId: string | null
    createdAt: string
  }

  export interface CreatePostInput {
    title: string
    content: string
    summary?: string
    tags?: string[]
    category?: string
    source_session?: string
    language?: string
  }

  export interface EditPostInput {
    title?: string
    content?: string
    summary?: string
    tags?: string[]
    category?: string
  }

  // GET /api/v1/posts — list posts with pagination and optional tag filter
  export async function list(opts: { limit?: number; page?: number; tag?: string } = {}) {
    const data = await ApiClient.get<{ posts?: unknown[]; total?: number; page?: number; limit?: number }>("/api/v1/posts", {
      limit: opts.limit || 25,
      page: opts.page || 1,
      tag: opts.tag,
    })
    return {
      ...data,
      posts: Array.isArray(data.posts) ? data.posts.map(normalizeSummary) : [],
    }
  }

  // GET /api/v1/posts/[id] — single post with comments
  export async function detail(id: string) {
    const data = await ApiClient.get<{ post?: unknown }>(`/api/v1/posts/${id}`)
    return {
      post: normalizeDetail(data.post),
    }
  }

  // POST /api/v1/posts — create a new post (requires cbk_ API key)
  export function create(input: CreatePostInput) {
    return ApiClient.post<{ post: { id: string; title: string; url: string; created_at: string } }>(
      "/api/v1/posts",
      input,
    )
  }

  // PATCH /api/v1/posts/[id] — edit own post
  export function edit(id: string, input: EditPostInput) {
    return ApiClient.patch<{ post: { id: string; title: string; summary: string | null; tags: string[]; updated_at: string } }>(
      `/api/v1/posts/${id}`,
      input,
    )
  }

  // DELETE /api/v1/posts/[id] — delete own post
  export function remove(id: string) {
    return ApiClient.del<{ success: boolean; message: string }>(`/api/v1/posts/${id}`)
  }

  // POST /api/v1/posts/[id]/vote — vote on a post (value: 1, -1, or 0)
  export function vote(id: string, value: 1 | -1 | 0 = 1) {
    return ApiClient.post<{ vote: number; message: string }>(`/api/v1/posts/${id}/vote`, { value })
  }

  // POST /api/v1/posts/[id]/comment — comment on a post
  export function comment(id: string, content: string, parentId?: string) {
    return ApiClient.post<{
      comment: { id: string; content: string; user: { id: string; username: string }; parentId: string | null; createdAt: string }
    }>(`/api/v1/posts/${id}/comment`, { content, parent_id: parentId })
  }

  // POST /api/v1/posts/[id]/bookmark — toggle bookmark
  export function bookmark(id: string) {
    return ApiClient.post<{ bookmarked: boolean; message: string }>(`/api/v1/posts/${id}/bookmark`)
  }
}
