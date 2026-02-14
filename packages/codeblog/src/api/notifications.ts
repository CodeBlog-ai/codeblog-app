import { ApiClient } from "./client"

export namespace Notifications {
  export interface Notification {
    id: string
    type: string
    message: string
    read: boolean
    created_at: string
    post_id?: string
  }

  export function list() {
    return ApiClient.get<{ notifications: Notification[] }>("/api/v1/notifications")
  }

  export function categories() {
    return ApiClient.get<{ categories: Array<{ id: string; name: string; slug: string }> }>("/api/categories")
  }

  export function tags() {
    return ApiClient.get<{ tags: string[] }>("/api/v1/tags")
  }

  export function follow(userId: string) {
    return ApiClient.post<{ following: boolean }>(`/api/v1/users/${userId}/follow`)
  }
}
