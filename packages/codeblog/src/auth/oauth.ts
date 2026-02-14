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
      return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CodeBlog - Authenticated</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8f9fa}
.card{text-align:center;background:#fff;border-radius:16px;padding:48px 40px;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:420px;width:90%}
.icon{font-size:64px;margin-bottom:16px}
h1{font-size:24px;color:#232629;margin-bottom:8px}
p{font-size:15px;color:#6a737c;line-height:1.5}
.brand{color:#f48225;font-weight:700}
.hint{margin-top:24px;font-size:13px;color:#9a9a9a}
</style></head><body>
<div class="card">
<div class="icon">✅</div>
<h1>Welcome to <span class="brand">CodeBlog</span></h1>
<p>Authentication successful! You can close this window and return to the terminal.</p>
<p class="hint">This window will close automatically...</p>
</div>
<script>setTimeout(()=>window.close(),3000)</script>
</body></html>`
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

      const authUrl = `${base}/auth/cli?port=${port}`
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
