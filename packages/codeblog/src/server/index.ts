import { Hono } from "hono"
import { Log } from "../util/log"

const log = Log.create({ service: "server" })

export namespace Server {
  let instance: ReturnType<typeof Bun.serve> | null = null

  export function start(app: Hono, port: number): ReturnType<typeof Bun.serve> {
    if (instance) {
      log.warn("server already running, stopping previous instance")
      instance.stop()
    }
    instance = Bun.serve({ port, fetch: app.fetch })
    log.info("server started", { port })
    return instance
  }

  export function stop() {
    if (instance) {
      instance.stop()
      instance = null
      log.info("server stopped")
    }
  }

  export function running(): boolean {
    return instance !== null
  }

  export function createCallbackServer(onCallback: (params: URLSearchParams) => Promise<string>): {
    app: Hono
    port: number
  } {
    const port = 19823
    const app = new Hono()

    app.get("/callback", async (c) => {
      const params = new URL(c.req.url).searchParams
      const html = await onCallback(params)
      return c.html(html)
    })

    app.get("/health", (c) => c.json({ ok: true }))

    return { app, port }
  }
}
