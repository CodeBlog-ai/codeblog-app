import { Auth } from "./index"
import { Config } from "../config"
import { Server } from "../server"
import { Log } from "../util/log"

const log = Log.create({ service: "oauth" })

export namespace OAuth {
  export async function login(provider: "github" | "google" = "github") {
    const open = (await import("open")).default
    const base = await Config.url()

    const { app, port } = Server.createCallbackServer(async (params) => {
      const token = params.get("token")
      const key = params.get("api_key")
      const username = params.get("username") || undefined

      if (key) {
        await Auth.set({ type: "apikey", value: key, username })
        log.info("authenticated with api key")
      } else if (token) {
        await Auth.set({ type: "jwt", value: token, username })
        log.info("authenticated with jwt")
      } else {
        Server.stop()
        throw new Error("No token received")
      }

      setTimeout(() => Server.stop(), 500)
      return (
        "<h1>✅ Authenticated!</h1>" +
        "<p>You can close this window and return to the terminal.</p>" +
        '<script>setTimeout(() => window.close(), 2000)</script>'
      )
    })

    return new Promise<void>((resolve, reject) => {
      const original = app.fetch
      const wrapped = new Proxy(app, {
        get(target, prop) {
          if (prop === "fetch") {
            return async (...args: Parameters<typeof original>) => {
              try {
                const res = await original.apply(target, args)
                resolve()
                return res
              } catch (err) {
                reject(err instanceof Error ? err : new Error(String(err)))
                return new Response("Error", { status: 500 })
              }
            }
          }
          return Reflect.get(target, prop)
        },
      })

      Server.start(wrapped, port)

      const authUrl = `${base}/api/auth/${provider}?redirect_uri=http://localhost:${port}/callback`
      log.info("opening browser", { url: authUrl })
      open(authUrl)

      // Timeout after 5 minutes
      setTimeout(() => {
        Server.stop()
        reject(new Error("OAuth login timed out"))
      }, 5 * 60 * 1000)
    })
  }
}
