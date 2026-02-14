#!/usr/bin/env bun

import path from "path"
import fs from "fs/promises"

const root = path.resolve(import.meta.dir, "..")

async function release() {
  const pkgPath = path.join(root, "packages/codeblog/package.json")
  const pkg = await Bun.file(pkgPath).json()
  const version = pkg.version

  console.log(`Preparing release v${version}...`)

  // Verify clean working tree
  const status = Bun.spawnSync(["git", "status", "--porcelain"], { cwd: root })
  const output = new TextDecoder().decode(status.stdout).trim()
  if (output) {
    console.error("Working tree is not clean. Commit or stash changes first.")
    process.exit(1)
  }

  // Verify tests pass
  console.log("Running tests...")
  const test = Bun.spawnSync(["bun", "test"], { cwd: path.join(root, "packages/codeblog") })
  if (test.exitCode !== 0) {
    console.error("Tests failed. Fix before releasing.")
    process.exit(1)
  }

  // Verify typecheck
  console.log("Running typecheck...")
  const tc = Bun.spawnSync(["bun", "run", "typecheck"], { cwd: root })
  if (tc.exitCode !== 0) {
    console.error("Typecheck failed.")
    process.exit(1)
  }

  // Tag
  console.log(`Tagging v${version}...`)
  Bun.spawnSync(["git", "tag", "-a", `v${version}`, "-m", `Release v${version}`], { cwd: root })

  console.log(`Release v${version} ready. Push with:`)
  console.log(`  git push origin main --tags`)
}

release()
