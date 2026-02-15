import { describe, expect, test } from "bun:test"
import fs from "fs"
import os from "os"
import path from "path"
import { listDirs, listFiles, safeReadFile, safeReadJson, safeStats } from "../fs-utils"

describe("fs-utils", () => {
  test("safeReadFile returns null for missing file", () => {
    expect(safeReadFile("/nonexistent/file.txt")).toBeNull()
  })

  test("safeReadJson parses valid json", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codeblog-fs-"))
    const file = path.join(dir, "a.json")
    fs.writeFileSync(file, '{"a":1}')
    expect(safeReadJson<{ a: number }>(file)?.a).toBe(1)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  test("listFiles and listDirs list local paths", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codeblog-fs-"))
    const sub = path.join(dir, "sub")
    fs.mkdirSync(sub)
    fs.writeFileSync(path.join(dir, "a.txt"), "x")
    fs.writeFileSync(path.join(sub, "b.json"), "{}")

    const dirs = listDirs(dir)
    const files = listFiles(dir, [".txt"], false)
    const nested = listFiles(dir, [".json"], true)

    expect(dirs.some((p) => p.endsWith("/sub")) || dirs.some((p) => p.endsWith("\\sub"))).toBe(true)
    expect(files.length).toBe(1)
    expect(nested.length).toBe(1)
    expect(safeStats(path.join(dir, "a.txt"))?.size).toBeGreaterThan(0)

    fs.rmSync(dir, { recursive: true, force: true })
  })
})
