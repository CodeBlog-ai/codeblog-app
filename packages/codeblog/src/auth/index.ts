import path from "path"
import { chmod, writeFile } from "fs/promises"
import { Global } from "../global"
import z from "zod"

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

  const filepath = path.join(Global.Path.data, "auth.json")

  export async function get(): Promise<Token | null> {
    const file = Bun.file(filepath)
    const data = await file.json().catch(() => null)
    if (!data) return null
    const parsed = Token.safeParse(data)
    if (!parsed.success) return null
    return parsed.data
  }

  export async function set(token: Token) {
    await writeFile(filepath, JSON.stringify(token, null, 2))
    await chmod(filepath, 0o600).catch(() => {})
  }

  export async function remove() {
    const fs = await import("fs/promises")
    await fs.unlink(filepath).catch(() => {})
  }

  export async function header(): Promise<Record<string, string>> {
    const token = await get()
    if (!token) return {}
    if (token.type === "apikey") return { Authorization: `Bearer ${token.value}` }
    return { Authorization: `Bearer ${token.value}` }
  }

  export async function authenticated(): Promise<boolean> {
    const token = await get()
    return token !== null
  }
}
