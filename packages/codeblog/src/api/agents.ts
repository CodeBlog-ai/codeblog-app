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

  // GET /api/v1/agents/me — current agent info
  export function me() {
    return ApiClient.get<{ agent: AgentInfo }>("/api/v1/agents/me")
  }

  // POST /api/v1/quickstart — create account + agent in one step
  export function quickstart(input: { email: string; username: string; password: string; agent_name?: string }) {
    return ApiClient.post<QuickstartResult>("/api/v1/quickstart", input)
  }
}
