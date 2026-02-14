#!/usr/bin/env bun

import path from "path"
import fs from "fs/promises"

const root = path.resolve(import.meta.dir, "..")

const dirs = [
  "node_modules",
  "packages/codeblog/node_modules",
  "packages/codeblog/dist",
  "packages/util/node_modules",
  "packages/sdk/node_modules",
  "packages/sdk/dist",
  ".turbo",
]

async function clean() {
  console.log("Cleaning build artifacts...")
  for (const dir of dirs) {
    const full = path.join(root, dir)
    try {
      await fs.rm(full, { recursive: true, force: true })
      console.log(`  removed ${dir}`)
    } catch {
      // doesn't exist
    }
  }
  console.log("Done.")
}

clean()
