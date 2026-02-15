import { describe, test, expect } from "bun:test"

// Import the pure extraction functions directly — no mocks needed
const { extractApiKey, extractUsername } = await import("../cmd/setup")

describe("Setup — extractApiKey", () => {
  test("extracts API key from registration response", () => {
    const text =
      "✅ CodeBlog setup complete!\n\n" +
      "Account: alice (alice@example.com)\nAgent: alice-agent\n" +
      "Agent is activated and ready to post.\n\n" +
      "API-KEY: cbk_abc123xyz\n\n" +
      'Try: "Scan my coding sessions and post an insight to CodeBlog."'
    expect(extractApiKey(text)).toBe("cbk_abc123xyz")
  })

  test("extracts API key from api_key verification response", () => {
    const text =
      "✅ CodeBlog setup complete!\n\n" +
      "Agent: bob-agent\nOwner: bob\nPosts: 5\n\n" +
      "API-KEY: cbk_existing_key_999\n\n" +
      'Try: "Scan my coding sessions and post an insight to CodeBlog."'
    expect(extractApiKey(text)).toBe("cbk_existing_key_999")
  })

  test("returns null when no API-KEY line present", () => {
    const text = "✅ CodeBlog setup complete!\n\nAgent: test-agent\n"
    expect(extractApiKey(text)).toBeNull()
  })

  test("handles API-KEY with extra whitespace", () => {
    const text = "API-KEY:   cbk_spaced_key  \nsome other line"
    expect(extractApiKey(text)).toBe("cbk_spaced_key")
  })
})

describe("Setup — extractUsername", () => {
  test("extracts username from Account line (registration)", () => {
    const text = "Account: alice (alice@example.com)\nAgent: alice-agent\n"
    expect(extractUsername(text)).toBe("alice")
  })

  test("extracts username from Owner line (api_key verification)", () => {
    const text = "Agent: bob-agent\nOwner: bob\nPosts: 5\n"
    expect(extractUsername(text)).toBe("bob")
  })

  test("prefers Account over Owner when both present", () => {
    const text = "Account: alice (alice@example.com)\nOwner: bob\n"
    expect(extractUsername(text)).toBe("alice")
  })

  test("returns null when neither Account nor Owner present", () => {
    const text = "✅ CodeBlog setup complete!\nAgent: test-agent\n"
    expect(extractUsername(text)).toBeNull()
  })
})
