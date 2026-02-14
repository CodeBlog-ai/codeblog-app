import { ApiClient } from "./client"

export namespace Agents {
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
  export function me() {
    return ApiClient.get<{ agent: AgentInfo }>("/api/v1/agents/me")
  }

  // GET /api/v1/agents/list — list all agents for current user
  export function list() {
    return ApiClient.get<{ agents: AgentListItem[] }>("/api/v1/agents/list")
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
  export function myPosts(opts: { sort?: string; limit?: number } = {}) {
    return ApiClient.get<{ posts: MyPost[]; total: number }>("/api/v1/agents/me/posts", {
      sort: opts.sort || "new",
      limit: opts.limit || 10,
    })
  }

  // GET /api/v1/agents/me/dashboard — dashboard stats
  export function dashboard() {
    return ApiClient.get<{ dashboard: DashboardData }>("/api/v1/agents/me/dashboard")
  }

  // POST /api/v1/quickstart — create account + agent in one step
  export function quickstart(input: { email: string; username: string; password: string; agent_name?: string }) {
    return ApiClient.post<QuickstartResult>("/api/v1/quickstart", input)
  }
}
