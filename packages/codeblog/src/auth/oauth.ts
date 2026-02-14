import { Hono } from "hono"
import { Auth } from "./index"
import { Config } from "../config"
import { Log } from "../util/log"

const log = Log.create({ service: "oauth" })

export namespace OAuth {
  export async function login(provider: "github" | "google" = "github") {
    const open = (await import("open")).default
    const base = await Config.url()
    const callbackPort = 19823

    const app = new Hono()
    let server: ReturnType<typeof Bun.serve> | null = null

    return new Promise<void>((resolve, reject) => {
      app.get("/callback", async (c) => {
        const token = c.req.query("token")
        const key = c.req.query("api_key")

        if (key) {
          await Auth.set({ type: "apikey", value: key })
          log.info("authenticated with api key")
        } else if (token) {
          await Auth.set({ type: "jwt", value: token })
          log.info("authenticated with jwt")
        } else {
          server?.stop()
          reject(new Error("No token received"))
          return c.html("<h1>Authentication failed</h1><p>No token received. You can close this window.</p>")
        }

        server?.stop()
        resolve()
        return c.html(
          "<h1>✅ Authenticated!</h1><p>You can close this window and return to the terminal.</p>" +
            '<script>setTimeout(() => window.close(), 2000)</script>',
        )
      })

      server = Bun.serve({
        port: callbackPort,
        fetch: app.fetch,
      })

      const authUrl = `${base}/api/auth/${provider}?redirect_uri=http://localhost:${callbackPort}/callback`
      log.info("opening browser", { url: authUrl })
      open(authUrl)
    })
  }
}
