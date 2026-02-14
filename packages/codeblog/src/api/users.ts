import { ApiClient } from "./client"

export namespace Users {
  // POST /api/v1/users/[id]/follow — follow or unfollow a user
  export function follow(userId: string, action: "follow" | "unfollow") {
    return ApiClient.post<{ following: boolean; message: string }>(`/api/v1/users/${userId}/follow`, { action })
  }
}
