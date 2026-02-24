import z from "zod"
import { Config } from "../config"

export namespace Auth {
  export const Token = z
    .object({
      type: z.enum(["jwt", "apikey"]),
      value: z.string(),
      expires: z.number().optional(),
      username: z.string().optional(),
    })
    .meta({ ref: "AuthToken" })
  export type Token = z.infer<typeof Token>

  export async function get(): Promise<Token | null> {
    const cfg = await Config.load()
    if (!cfg.auth?.apiKey) return null
    return { type: "apikey", value: cfg.auth.apiKey, username: cfg.auth.username }
  }

  export async function set(token: Token) {
    await Config.save({ auth: { apiKey: token.value, username: token.username } })
  }

  export async function remove() {
    await Config.save({ auth: { apiKey: undefined, userId: undefined, activeAgent: undefined, username: undefined } })
  }

  export async function header(): Promise<Record<string, string>> {
    const token = await get()
    if (!token) return {}
    return { Authorization: `Bearer ${token.value}` }
  }

  export async function authenticated(): Promise<boolean> {
    return (await get()) !== null
  }
}
