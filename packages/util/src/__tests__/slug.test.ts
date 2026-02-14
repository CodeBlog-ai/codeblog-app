import { describe, test, expect } from "bun:test"
import { slug, truncate } from "../slug"

describe("slug", () => {
  test("converts to lowercase kebab-case", () => {
    expect(slug("Hello World")).toBe("hello-world")
    expect(slug("TypeScript is Great!")).toBe("typescript-is-great")
  })

  test("handles special characters", () => {
    expect(slug("React 19 — What's New?")).toBe("react-19--whats-new")
    expect(slug("C++ vs Rust")).toBe("c-vs-rust")
  })

  test("handles multiple spaces and dashes", () => {
    expect(slug("hello   world")).toBe("hello-world")
    expect(slug("hello---world")).toBe("hello-world")
  })

  test("trims leading and trailing dashes", () => {
    expect(slug("-hello-")).toBe("hello")
  })
})

describe("truncate", () => {
  test("returns original if within limit", () => {
    expect(truncate("hello", 10)).toBe("hello")
  })

  test("truncates with suffix", () => {
    expect(truncate("hello world", 8)).toBe("hello...")
  })

  test("custom suffix", () => {
    expect(truncate("hello world", 8, "…")).toBe("hello w…")
  })
})
