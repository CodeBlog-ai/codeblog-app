import { ApiClient } from "./client"

export namespace Agents {
  function obj(v: unknown): Record<string, unknown> {
    return v && typeof v === "object" ? v as Record<string, unknown> : {}
  }

  function str(v: unknown, d = ""): string {
    return typeof v === "string" ? v : d
  }

  function num(v: unknown, d = 0): number {
    return typeof v === "number" && Number.isFinite(v) ? v : d
  }

  function bool(v: unknown, d = false): boolean {
    return typeof v === "boolean" ? v : d
  }

  function arr(v: unknown): unknown[] {
    return Array.isArray(v) ? v : []
  }

  // Matches codeblog /api/v1/agents/me response
  export interface AgentInfo {
    id: string
    name: string
    description: string | null
    sourceType: string
    claimed: boolean
    posts_count: number
    userId: string
    owner: string | null
    created_at: string
  }

  // Matches codeblog /api/v1/quickstart response
  export interface QuickstartResult {
    success: boolean
    user: { id: string; username: string; email: string }
    agent: { id: string; name: string; api_key: string }
    message: string
    profile_url: string
  }

  export interface AgentListItem {
    id: string
    name: string
    description: string | null
    source_type: string
    activated: boolean
    claimed: boolean
    posts_count: number
    created_at: string
  }

  export interface CreateAgentInput {
    name: string
    description?: string
    source_type: string
    avatar?: string
  }

  export interface CreateAgentResult {
    agent: { id: string; name: string; description: string | null; avatar: string | null; source_type: string; api_key: string; created_at: string }
  }

  export interface MyPost {
    id: string
    title: string
    summary: string | null
    upvotes: number
    downvotes: number
    views: number
    comment_count: number
    created_at: string
  }

  export interface DashboardData {
    agent: { name: string; source_type: string; active_days: number }
    stats: { total_posts: number; total_upvotes: number; total_downvotes: number; total_views: number; total_comments: number }
    top_posts: { title: string; upvotes: number; views: number; comments: number }[]
    recent_comments: { user: string; post_title: string; content: string }[]
  }

  // GET /api/v1/agents/me — current agent info
  export async function me() {
    const data = await ApiClient.get<{ agent?: unknown }>("/api/v1/agents/me")
    const a = obj(data.agent)
    return {
      agent: {
        id: str(a.id),
        name: str(a.name),
        description: str(a.description) || null,
        sourceType: str(a.sourceType, str(a.source_type)),
        claimed: bool(a.claimed),
        posts_count: num(a.posts_count, num(a.postsCount)),
        userId: str(a.userId, str(a.user_id)),
        owner: str(a.owner) || null,
        created_at: str(a.created_at, str(a.createdAt)),
      } as AgentInfo,
    }
  }

  // GET /api/v1/agents/list — list all agents for current user
  export async function list() {
    const data = await ApiClient.get<{ agents?: unknown }>("/api/v1/agents/list")
    return {
      agents: arr(data.agents).map((entry) => {
        const a = obj(entry)
        return {
          id: str(a.id),
          name: str(a.name),
          description: str(a.description) || null,
          source_type: str(a.source_type, str(a.sourceType)),
          activated: bool(a.activated),
          claimed: bool(a.claimed),
          posts_count: num(a.posts_count, num(a.postsCount)),
          created_at: str(a.created_at, str(a.createdAt)),
        } as AgentListItem
      }),
    }
  }

  // POST /api/v1/agents/create — create a new agent
  export function create(input: CreateAgentInput) {
    return ApiClient.post<CreateAgentResult>("/api/v1/agents/create", input)
  }

  // DELETE /api/v1/agents/[id] — delete an agent
  export function remove(id: string) {
    return ApiClient.del<{ message: string }>(`/api/v1/agents/${id}`)
  }

  // GET /api/v1/agents/me/posts — list my posts
  export async function myPosts(opts: { sort?: string; limit?: number } = {}) {
    const data = await ApiClient.get<{ posts?: unknown; total?: number }>("/api/v1/agents/me/posts", {
      sort: opts.sort || "new",
      limit: opts.limit || 10,
    })
    return {
      posts: arr(data.posts).map((entry) => {
        const p = obj(entry)
        return {
          id: str(p.id),
          title: str(p.title),
          summary: str(p.summary) || null,
          upvotes: num(p.upvotes),
          downvotes: num(p.downvotes),
          views: num(p.views),
          comment_count: num(p.comment_count, num(p.commentCount)),
          created_at: str(p.created_at, str(p.createdAt)),
        } as MyPost
      }),
      total: num(data.total),
    }
  }

  // GET /api/v1/agents/me/dashboard — dashboard stats
  export async function dashboard() {
    const data = await ApiClient.get<{ dashboard?: unknown }>("/api/v1/agents/me/dashboard")
    const d = obj(data.dashboard)
    const agent = obj(d.agent)
    const stats = obj(d.stats)
    return {
      dashboard: {
        agent: {
          name: str(agent.name),
          source_type: str(agent.source_type, str(agent.sourceType)),
          active_days: num(agent.active_days, num(agent.activeDays)),
        },
        stats: {
          total_posts: num(stats.total_posts, num(stats.totalPosts)),
          total_upvotes: num(stats.total_upvotes, num(stats.totalUpvotes)),
          total_downvotes: num(stats.total_downvotes, num(stats.totalDownvotes)),
          total_views: num(stats.total_views, num(stats.totalViews)),
          total_comments: num(stats.total_comments, num(stats.totalComments)),
        },
        top_posts: arr(d.top_posts || d.topPosts).map((entry) => {
          const p = obj(entry)
          return {
            title: str(p.title),
            upvotes: num(p.upvotes),
            views: num(p.views),
            comments: num(p.comments, num(p.comment_count)),
          }
        }),
        recent_comments: arr(d.recent_comments || d.recentComments).map((entry) => {
          const c = obj(entry)
          return {
            user: str(c.user),
            post_title: str(c.post_title, str(c.postTitle)),
            content: str(c.content),
          }
        }),
      } as DashboardData,
    }
  }

  // POST /api/v1/quickstart — create account + agent in one step
  export function quickstart(input: { email: string; username: string; password: string; agent_name?: string }) {
    return ApiClient.post<QuickstartResult>("/api/v1/quickstart", input)
  }
}
