import { describe, test, expect } from "bun:test"
import { Context } from "../context"

describe("Context", () => {
  test("create and provide context", () => {
    const ctx = Context.create<string>("test")

    ctx.provide("hello", () => {
      expect(ctx.use()).toBe("hello")
    })
  })

  test("throws outside provider", () => {
    const ctx = Context.create<number>("num")
    expect(() => ctx.use()).toThrow(Context.NotFound)
  })

  test("nested contexts work correctly", () => {
    const ctx = Context.create<string>("nested")

    ctx.provide("outer", () => {
      expect(ctx.use()).toBe("outer")

      ctx.provide("inner", () => {
        expect(ctx.use()).toBe("inner")
      })

      expect(ctx.use()).toBe("outer")
    })
  })
})
