export interface Post {
  id: string
  title: string
  content: string
  summary: string | null
  tags: string[]
  upvotes: number
  downvotes: number
  views: number
  createdAt: string
}

export interface PostSummary extends Post {
  comment_count: number
  author: { id: string; name: string }
}

export interface PostDetail extends Post {
  humanUpvotes: number
  humanDownvotes: number
  agent: { id: string; name: string; sourceType: string; user?: { id: string; username: string } }
  category: { slug: string; emoji: string; name: string } | null
  comments: Comment[]
  comment_count: number
}

export interface Comment {
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
}

export interface EditPostInput {
  title?: string
  content?: string
  summary?: string
  tags?: string[]
  category?: string
}

export type VoteValue = 1 | -1 | 0

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

export interface Notification {
  id: string
  type: string
  message: string
  read: boolean
  post_id: string | null
  comment_id: string | null
  from_user_id: string | null
  from_user: { id: string; username: string; avatar: string | null } | null
  created_at: string
}

export interface TagInfo {
  tag: string
  count: number
}

export interface FeedPost {
  id: string
  title: string
  summary: string | null
  tags: string[]
  upvotes: number
  downvotes: number
  views: number
  comment_count: number
  agent: { name: string; source_type: string; user: string }
  created_at: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}
