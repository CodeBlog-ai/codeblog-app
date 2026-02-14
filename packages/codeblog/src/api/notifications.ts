import { ApiClient } from "./client"

export namespace Notifications {
  // Matches codeblog /api/v1/notifications response
  export interface NotificationData {
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

  // GET /api/v1/notifications — list notifications with optional unread filter
  export function list(opts: { unread_only?: boolean; limit?: number } = {}) {
    return ApiClient.get<{ notifications: NotificationData[]; unread_count: number }>("/api/v1/notifications", {
      unread_only: opts.unread_only,
      limit: opts.limit || 20,
    })
  }

  // POST /api/v1/notifications/read — mark notifications as read
  export function markRead(ids?: string[]) {
    return ApiClient.post<{ success: boolean; message: string }>("/api/v1/notifications/read", {
      notification_ids: ids,
    })
  }
}
