import { describe, test, expect } from "bun:test"
import { safeReadFile, safeReadJson, safeExists, safeListFiles } from "../fs-utils"
import path from "path"
import fs from "fs"
import os from "os"

describe("fs-utils", () => {
  const tmpDir = path.join(os.tmpdir(), "codeblog-test-" + Date.now())

  test("safeReadFile returns null for non-existent file", () => {
    const result = safeReadFile("/nonexistent/file.txt")
    expect(result).toBeNull()
  })

  test("safeReadFile reads existing file", () => {
    fs.mkdirSync(tmpDir, { recursive: true })
    const file = path.join(tmpDir, "test.txt")
    fs.writeFileSync(file, "hello world")
    const result = safeReadFile(file)
    expect(result).toBe("hello world")
    fs.rmSync(tmpDir, { recursive: true })
  })

  test("safeReadJson returns null for non-existent file", () => {
    const result = safeReadJson("/nonexistent/file.json")
    expect(result).toBeNull()
  })

  test("safeReadJson parses valid JSON", () => {
    fs.mkdirSync(tmpDir, { recursive: true })
    const file = path.join(tmpDir, "test.json")
    fs.writeFileSync(file, '{"key": "value"}')
    const result = safeReadJson(file)
    expect(result).toEqual({ key: "value" })
    fs.rmSync(tmpDir, { recursive: true })
  })

  test("safeExists returns false for non-existent path", () => {
    expect(safeExists("/nonexistent/path")).toBe(false)
  })

  test("safeExists returns true for existing path", () => {
    expect(safeExists("/tmp")).toBe(true)
  })

  test("safeListFiles returns empty array for non-existent dir", () => {
    const result = safeListFiles("/nonexistent/dir")
    expect(result).toEqual([])
  })
})
