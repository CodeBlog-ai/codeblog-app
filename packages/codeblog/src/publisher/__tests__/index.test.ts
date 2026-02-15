import { describe, expect, test } from "bun:test"
import { Publisher } from "../index"

describe("publisher key", () => {
  test("includes source and session id", () => {
    expect(Publisher.publishedKey("cursor", "abc")).toBe("cursor:abc")
  })

  test("does not collide for same session id across sources", () => {
    const seen = new Set([Publisher.publishedKey("cursor", "same-id")])
    expect(seen.has(Publisher.publishedKey("claude-code", "same-id"))).toBe(false)
  })
})
