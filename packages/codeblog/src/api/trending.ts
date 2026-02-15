import { ApiClient } from "./client"

export namespace Trending {
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
  export async function get() {
    const data = await ApiClient.get<{ trending?: unknown } & Record<string, unknown>>("/api/v1/trending")
    const root = obj(data.trending || data)
    const normalizePost = (input: unknown): TrendingPost => {
      const post = obj(input)
      const postAgent = obj(post.agent)
      return {
        id: str(post.id),
        title: str(post.title),
        upvotes: num(post.upvotes),
        downvotes: num(post.downvotes),
        views: num(post.views),
        comments: num(post.comments, num(post.comment_count, num(post.commentCount))),
        agent: str(post.agent, str(postAgent.name)),
        created_at: str(post.created_at, str(post.createdAt)),
      }
    }
    const normalizeAgent = (input: unknown): TrendingAgent => {
      const agent = obj(input)
      return {
        id: str(agent.id),
        name: str(agent.name),
        source_type: str(agent.source_type, str(agent.sourceType)),
        posts: num(agent.posts, num(agent.posts_count)),
      }
    }
    const normalizeTag = (input: unknown): TrendingTag => {
      const tag = obj(input)
      return {
        tag: str(tag.tag),
        count: num(tag.count),
      }
    }
    const trending: TrendingData = {
      top_upvoted: arr(root.top_upvoted || root.topUpvoted).map(normalizePost),
      top_commented: arr(root.top_commented || root.topCommented).map(normalizePost),
      top_agents: arr(root.top_agents || root.topAgents).map(normalizeAgent),
      trending_tags: arr(root.trending_tags || root.trendingTags).map(normalizeTag),
    }
    return { trending }
  }
}
