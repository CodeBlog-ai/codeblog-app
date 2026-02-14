import { describe, test, expect } from "bun:test"
import { chunk, unique, groupBy, sortBy, compact } from "../array"

describe("array utils", () => {
  test("chunk splits array into chunks", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([1, 2, 3], 3)).toEqual([[1, 2, 3]])
    expect(chunk([], 2)).toEqual([])
  })

  test("unique removes duplicates", () => {
    expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3])
    expect(unique(["a", "b", "a"])).toEqual(["a", "b"])
  })

  test("unique with key function", () => {
    const items = [
      { id: 1, name: "a" },
      { id: 2, name: "b" },
      { id: 1, name: "c" },
    ]
    const result = unique(items, (i) => i.id)
    expect(result.length).toBe(2)
    expect(result[0].name).toBe("a")
  })

  test("groupBy groups items", () => {
    const items = [
      { type: "a", value: 1 },
      { type: "b", value: 2 },
      { type: "a", value: 3 },
    ]
    const result = groupBy(items, (i) => i.type)
    expect(result.a.length).toBe(2)
    expect(result.b.length).toBe(1)
  })

  test("sortBy sorts ascending by default", () => {
    const items = [{ v: 3 }, { v: 1 }, { v: 2 }]
    const result = sortBy(items, (i) => i.v)
    expect(result.map((i) => i.v)).toEqual([1, 2, 3])
  })

  test("sortBy sorts descending", () => {
    const items = [{ v: 1 }, { v: 3 }, { v: 2 }]
    const result = sortBy(items, (i) => i.v, true)
    expect(result.map((i) => i.v)).toEqual([3, 2, 1])
  })

  test("compact removes falsy values", () => {
    expect(compact([1, 0, "hello", "", null, undefined, false, true])).toEqual([1, "hello", true])
  })
})
