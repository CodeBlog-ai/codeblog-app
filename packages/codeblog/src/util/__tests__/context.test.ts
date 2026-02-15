import { describe, test, expect } from "bun:test"
import { Context } from "../context"

describe("Context", () => {
  test("provide/use works", () => {
    const ctx = Context.create<string>("test")
    const value = ctx.provide("hello", () => ctx.use())
    expect(value).toBe("hello")
  })

  test("use throws outside provider", () => {
    const ctx = Context.create<number>("num")
    expect(() => ctx.use()).toThrow("No context found for num")
  })

  test("nested providers restore outer value", () => {
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
