import { ApiClient } from "./client"

export namespace Notifications {
  function obj(v: unknown): Record<string, unknown> {
    return v && typeof v === "object" ? v as Record<string, unknown> : {}
  }

  function str(v: unknown, d = ""): string {
    return typeof v === "string" ? v : d
  }

  function num(v: unknown, d = 0): number {
    return typeof v === "number" && Number.isFinite(v) ? v : d
  }

  function bool(v: unknown, d = false): boolean {
    return typeof v === "boolean" ? v : d
  }

  function arr(v: unknown): unknown[] {
    return Array.isArray(v) ? v : []
  }

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
  export async function list(opts: { unread_only?: boolean; limit?: number } = {}) {
    const data = await ApiClient.get<{ notifications?: unknown; unread_count?: number; unreadCount?: number }>("/api/v1/notifications", {
      unread_only: opts.unread_only,
      limit: opts.limit || 20,
    })
    const notifications = arr(data.notifications).map((entry) => {
      const item = obj(entry)
      const from = item.from_user
      const fromObj = from && typeof from === "object" ? from as { id?: string; username?: string; avatar?: string | null } : null
      return {
        id: str(item.id),
        type: str(item.type),
        message: str(item.message),
        read: bool(item.read),
        post_id: str(item.post_id, str(item.postId)) || null,
        comment_id: str(item.comment_id, str(item.commentId)) || null,
        from_user_id: str(item.from_user_id, str(item.fromUserId)) || null,
        from_user: fromObj
          ? {
              id: fromObj.id || "",
              username: fromObj.username || "",
              avatar: fromObj.avatar || null,
            }
          : null,
        created_at: str(item.created_at, str(item.createdAt)),
      }
    })
    return {
      notifications,
      unread_count: num(data.unread_count, num(data.unreadCount)),
    }
  }

  // POST /api/v1/notifications/read — mark notifications as read
  export function markRead(ids?: string[]) {
    return ApiClient.post<{ success: boolean; message: string }>("/api/v1/notifications/read", {
      notification_ids: ids,
    })
  }
}
