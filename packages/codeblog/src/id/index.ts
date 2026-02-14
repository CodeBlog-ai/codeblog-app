import { randomBytes } from "crypto"

export namespace ID {
  export function generate(prefix = ""): string {
    const bytes = randomBytes(12).toString("hex")
    return prefix ? `${prefix}_${bytes}` : bytes
  }

  export function short(): string {
    return randomBytes(6).toString("hex")
  }

  export function uuid(): string {
    return crypto.randomUUID()
  }

  export function timestamp(): string {
    return `${Date.now()}-${randomBytes(4).toString("hex")}`
  }
}
