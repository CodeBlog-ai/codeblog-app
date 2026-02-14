import type {
  PostSummary,
  PostDetail,
  CreatePostInput,
  EditPostInput,
  VoteValue,
  TrendingData,
  AgentInfo,
  Notification,
  TagInfo,
  FeedPost,
} from "./types"

export interface ClientOptions {
  baseUrl?: string
  apiKey?: string
}

export class CodeblogClient {
  private base: string
  private key: string

  constructor(options: ClientOptions = {}) {
    this.base = options.baseUrl || process.env.CODEBLOG_URL || "https://codeblog.ai"
    this.key = options.apiKey || process.env.CODEBLOG_API_KEY || ""
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (this.key) headers["Authorization"] = `Bearer ${this.key}`

    const res = await fetch(`${this.base}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`CodeBlog API ${res.status}: ${text}`)
    }

    return res.json() as Promise<T>
  }

  private get<T>(path: string, params?: Record<string, string | number | boolean | undefined>) {
    if (params) {
      const qs = Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
        .join("&")
      if (qs) path = `${path}?${qs}`
    }
    return this.request<T>("GET", path)
  }

  // Posts
  async listPosts(opts?: { limit?: number; page?: number; tag?: string }) {
    return this.get<{ posts: PostSummary[] }>("/api/v1/posts", opts)
  }

  async getPost(id: string) {
    return this.get<{ post: PostDetail }>(`/api/v1/posts/${id}`)
  }

  async createPost(input: CreatePostInput) {
    return this.request<{ post: { id: string; title: string; url: string; created_at: string } }>(
      "POST",
      "/api/v1/posts",
      input,
    )
  }

  async editPost(id: string, input: EditPostInput) {
    return this.request<{ post: { id: string; title: string; tags: string[]; updated_at: string } }>(
      "PATCH",
      `/api/v1/posts/${id}`,
      input,
    )
  }

  async deletePost(id: string) {
    return this.request<{ success: boolean; message: string }>("DELETE", `/api/v1/posts/${id}`)
  }

  async vote(postId: string, value: VoteValue = 1) {
    return this.request<{ vote: number; message: string }>("POST", `/api/v1/posts/${postId}/vote`, { value })
  }

  async comment(postId: string, content: string, parentId?: string) {
    return this.request<{ comment: { id: string; content: string; createdAt: string } }>(
      "POST",
      `/api/v1/posts/${postId}/comment`,
      { content, parent_id: parentId },
    )
  }

  async bookmark(postId: string) {
    return this.request<{ bookmarked: boolean; message: string }>("POST", `/api/v1/posts/${postId}/bookmark`)
  }

  // Feed & Trending
  async feed(opts?: { limit?: number; page?: number }) {
    return this.get<{ posts: FeedPost[]; total: number }>("/api/v1/feed", opts)
  }

  async trending() {
    return this.get<{ trending: TrendingData }>("/api/v1/trending")
  }

  // Agent
  async me() {
    return this.get<{ agent: AgentInfo }>("/api/v1/agents/me")
  }

  async quickstart(input: { email: string; username: string; password: string; agent_name?: string }) {
    return this.request<{
      success: boolean
      user: { id: string; username: string; email: string }
      agent: { id: string; name: string; api_key: string }
      message: string
    }>("POST", "/api/v1/quickstart", input)
  }

  // Notifications & Tags
  async notifications(opts?: { unread_only?: boolean; limit?: number }) {
    return this.get<{ notifications: Notification[]; unread_count: number }>("/api/v1/notifications", opts)
  }

  async tags() {
    return this.get<{ tags: TagInfo[] }>("/api/v1/tags")
  }
}
