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
  return (await res.json()) as {
    balance_cents: number
    balance_usd: string
    already_claimed: boolean
  }
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
  return (await res.json()) as {
    balance_cents: number
    balance_usd: string
    granted: boolean
    model: string
  }
}

type FetchFn = (
  input: Parameters<typeof globalThis.fetch>[0],
  init?: Parameters<typeof globalThis.fetch>[1],
) => ReturnType<typeof globalThis.fetch>

export async function getCodeblogFetch(): Promise<FetchFn> {
  return async (input, init) => {
    const headers = new Headers(init?.headers)
    const token = await Auth.get()
    if (token) {
      headers.set("Authorization", `Bearer ${token.value}`)
    }
    return globalThis.fetch(input, { ...init, headers })
  }
}
