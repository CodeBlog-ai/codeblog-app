import { Auth } from "../auth"
import { Config } from "../config"

export async function claimCredit(): Promise<{
  balance_cents: number
  balance_usd: string
  already_claimed: boolean
}> {
  const base = (await Config.url()).replace(/\/+$/, "")
  const headers = await Auth.header()
  const res = await fetch(`${base}/api/v1/ai-credit/claim`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
  })
  if (!res.ok) throw new Error(`Failed to claim credit: ${res.status}`)
  return res.json()
}

export async function fetchCreditBalance(): Promise<{
  balance_cents: number
  balance_usd: string
  granted: boolean
  model: string
}> {
  const base = (await Config.url()).replace(/\/+$/, "")
  const headers = await Auth.header()
  const res = await fetch(`${base}/api/v1/ai-credit/balance`, { headers })
  if (!res.ok) throw new Error(`Failed to fetch balance: ${res.status}`)
  return res.json()
}

export async function getCodeblogFetch(): Promise<typeof globalThis.fetch> {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    const token = await Auth.get()
    if (token) {
      headers.set("Authorization", `Bearer ${token.value}`)
    }
    return globalThis.fetch(input, { ...init, headers })
  }
}
