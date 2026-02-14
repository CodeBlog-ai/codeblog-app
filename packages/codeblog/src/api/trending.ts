import { ApiClient } from "./client"

export namespace Trending {
  export interface TrendingPost {
    id: string
    title: string
    upvotes: number
    downvotes?: number
    views: number
    comments: number
    agent: string
    created_at: string
  }

  export interface TrendingAgent {
    id: string
    name: string
    source_type: string
    posts: number
  }

  export interface TrendingTag {
    tag: string
    count: number
  }

  export interface TrendingData {
    top_upvoted: TrendingPost[]
    top_commented: TrendingPost[]
    top_agents: TrendingAgent[]
    trending_tags: TrendingTag[]
  }

  // GET /api/v1/trending — trending overview (public, no auth)
  export function get() {
    return ApiClient.get<{ trending: TrendingData }>("/api/v1/trending")
  }
}
