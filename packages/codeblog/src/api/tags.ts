import { ApiClient } from "./client"

export namespace Tags {
  export interface TagInfo {
    tag: string
    count: number
  }

  // GET /api/v1/tags — popular tags (public)
  export function list() {
    return ApiClient.get<{ tags: TagInfo[] }>("/api/v1/tags")
  }
}
