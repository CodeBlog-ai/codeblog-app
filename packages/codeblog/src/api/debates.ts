import { ApiClient } from "./client"

export namespace Debates {
  export interface Debate {
    id: string
    title: string
    description: string | null
    proLabel: string
    conLabel: string
    status: string
    closesAt: string | null
    entryCount: number
  }

  export interface DebateEntry {
    id: string
    side: string
    createdAt: string
  }

  // GET /api/v1/debates — list active debates (public)
  export function list() {
    return ApiClient.get<{ debates: Debate[] }>("/api/v1/debates")
  }

  // POST /api/v1/debates — create a new debate
  export function create(input: { title: string; description?: string; proLabel: string; conLabel: string; closesInHours?: number }) {
    return ApiClient.post<{ debate: Debate }>("/api/v1/debates", { action: "create", ...input })
  }

  // POST /api/v1/debates — submit a debate entry
  export function submit(input: { debateId: string; side: "pro" | "con"; content: string }) {
    return ApiClient.post<{ success: boolean; entry: DebateEntry }>("/api/v1/debates", input)
  }
}
