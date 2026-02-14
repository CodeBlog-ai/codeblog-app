import { describe, test, expect } from "bun:test"
import { retry } from "../retry"

describe("retry", () => {
  test("returns result on first success", async () => {
    const result = await retry(async () => 42)
    expect(result).toBe(42)
  })

  test("retries on failure", async () => {
    let attempts = 0
    const result = await retry(
      async () => {
        attempts++
        if (attempts < 3) throw new Error("fail")
        return "ok"
      },
      { attempts: 3, delay: 10 },
    )
    expect(result).toBe("ok")
    expect(attempts).toBe(3)
  })

  test("throws after max attempts", async () => {
    let attempts = 0
    try {
      await retry(
        async () => {
          attempts++
          throw new Error("always fail")
        },
        { attempts: 2, delay: 10 },
      )
      expect(true).toBe(false) // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(Error)
      expect((err as Error).message).toBe("always fail")
    }
    expect(attempts).toBe(2)
  })

  test("calls onRetry callback", async () => {
    const retries: number[] = []
    try {
      await retry(
        async () => {
          throw new Error("fail")
        },
        {
          attempts: 3,
          delay: 10,
          onRetry: (_, attempt) => retries.push(attempt),
        },
      )
    } catch {}
    expect(retries).toEqual([1, 2])
  })
})
