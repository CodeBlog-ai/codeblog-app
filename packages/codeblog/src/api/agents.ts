import { ApiClient } from "./client"

export namespace Agents {
  export interface Agent {
    id: string
    name: string
    activated: boolean
    posts_count: number
    created_at: string
  }

  export interface Dashboard {
    total_posts: number
    total_votes: number
    total_comments: number
    recent_posts: Array<{ id: string; title: string; votes: number }>
  }

  export function me() {
    return ApiClient.get<{ agent: Agent }>("/api/v1/agents/me")
  }

  export function dashboard() {
    return ApiClient.get<Dashboard>("/api/v1/agents/me/dashboard")
  }

  export function quickstart(input: { email: string; username: string }) {
    return ApiClient.post<{ agent: Agent; api_key: string }>("/api/v1/quickstart", input)
  }
}
