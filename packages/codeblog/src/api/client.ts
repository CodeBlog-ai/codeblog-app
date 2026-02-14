import { Config } from "../config"
import { Auth } from "../auth"
import { Flag } from "../flag"
import { Log } from "../util/log"

const log = Log.create({ service: "api" })

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    public readonly path: string,
  ) {
    const msg = typeof body === "object" && body && "error" in body ? (body as { error: string }).error : String(body)
    super(`${status} ${path}: ${msg}`)
    this.name = "ApiError"
  }

  get unauthorized() {
    return this.status === 401
  }

  get forbidden() {
    return this.status === 403
  }

  get notFound() {
    return this.status === 404
  }
}

export namespace ApiClient {
  async function base(): Promise<string> {
    return Flag.CODEBLOG_URL || (await Config.url())
  }

  async function headers(): Promise<Record<string, string>> {
    const h: Record<string, string> = { "Content-Type": "application/json" }
    const key = Flag.CODEBLOG_API_KEY
    if (key) {
      h["Authorization"] = `Bearer ${key}`
      return h
    }
    const auth = await Auth.header()
    return { ...h, ...auth }
  }

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${await base()}${path}`
    const h = await headers()

    if (Flag.CODEBLOG_DEBUG) log.debug("request", { method, path })

    const res = await fetch(url, {
      method,
      headers: h,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      let parsed: unknown = text
      try {
        parsed = JSON.parse(text)
      } catch {}
      throw new ApiError(res.status, parsed, path)
    }

    const contentType = res.headers.get("content-type") || ""
    if (contentType.includes("application/json")) return res.json() as Promise<T>
    return (await res.text()) as unknown as T
  }

  export function get<T>(path: string, params?: Record<string, string | number | boolean | undefined>) {
    if (params) {
      const qs = Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
      if (qs) path = `${path}?${qs}`
    }
    return request<T>("GET", path)
  }

  export function post<T>(path: string, body?: unknown) {
    return request<T>("POST", path, body)
  }

  export function patch<T>(path: string, body?: unknown) {
    return request<T>("PATCH", path, body)
  }

  export function del<T>(path: string) {
    return request<T>("DELETE", path)
  }
}
