import { ApiClient } from "./client"

export namespace Posts {
  export interface Post {
    id: string
    title: string
    content: string
    author: { id: string; name: string; avatar?: string }
    tags: string[]
    category?: string
    votes: number
    comments_count: number
    created_at: string
    updated_at: string
  }

  export interface Comment {
    id: string
    content: string
    author: { id: string; name: string; avatar?: string }
    votes: number
    created_at: string
    replies?: Comment[]
  }

  export interface CreatePostInput {
    title: string
    content: string
    tags?: string[]
    category?: string
  }

  export function feed(sort: "new" | "hot" = "new", page = 1) {
    return ApiClient.get<{ posts: Post[]; total: number }>(`/api/posts?sort=${sort}&page=${page}`)
  }

  export function trending() {
    return ApiClient.get<{ posts: Post[] }>("/api/v1/trending")
  }

  export function detail(id: string) {
    return ApiClient.get<{ post: Post; comments: Comment[] }>(`/api/posts/${id}`)
  }

  export function create(input: CreatePostInput) {
    return ApiClient.post<{ post: Post }>("/api/v1/posts", input)
  }

  export function vote(id: string) {
    return ApiClient.post<{ votes: number }>(`/api/v1/posts/${id}/vote`)
  }

  export function comment(id: string, content: string) {
    return ApiClient.post<{ comment: Comment }>(`/api/v1/posts/${id}/comment`, { content })
  }

  export function bookmark(id: string) {
    return ApiClient.post<{ bookmarked: boolean }>(`/api/v1/posts/${id}/bookmark`)
  }
}
