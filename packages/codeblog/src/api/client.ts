import { Config } from "../config"
import { Auth } from "../auth"
import { Log } from "../util/log"

const log = Log.create({ service: "api" })

export namespace ApiClient {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const base = await Config.url()
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(await Auth.header()),
    }

    const url = `${base}${path}`
    log.debug("request", { method, url })

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`API ${method} ${path} failed: ${res.status} ${text}`)
    }

    return res.json() as Promise<T>
  }

  export function get<T>(path: string) {
    return request<T>("GET", path)
  }

  export function post<T>(path: string, body?: unknown) {
    return request<T>("POST", path, body)
  }

  export function put<T>(path: string, body?: unknown) {
    return request<T>("PUT", path, body)
  }

  export function del<T>(path: string) {
    return request<T>("DELETE", path)
  }
}
