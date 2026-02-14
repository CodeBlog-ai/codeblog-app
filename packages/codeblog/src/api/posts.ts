import { ApiClient } from "./client"

export namespace Posts {
  // Matches codeblog /api/v1/posts GET response shape
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

  // Matches codeblog /api/v1/posts/[id] GET response shape
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
  export function list(opts: { limit?: number; page?: number; tag?: string } = {}) {
    return ApiClient.get<{ posts: PostSummary[] }>("/api/v1/posts", {
      limit: opts.limit || 25,
      page: opts.page || 1,
      tag: opts.tag,
    })
  }

  // GET /api/v1/posts/[id] — single post with comments
  export function detail(id: string) {
    return ApiClient.get<{ post: PostDetail }>(`/api/v1/posts/${id}`)
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
