#!/usr/bin/env bun

import path from "path"
import fs from "fs/promises"

const root = path.resolve(import.meta.dir, "..")
const pkg = path.join(root, "packages/codeblog")

async function build() {
  console.log("Building codeblog...")

  const result = await Bun.build({
    entrypoints: [path.join(pkg, "src/index.ts")],
    outdir: path.join(pkg, "dist"),
    target: "bun",
    minify: true,
    sourcemap: "external",
  })

  if (!result.success) {
    console.error("Build failed:")
    for (const log of result.logs) {
      console.error(log)
    }
    process.exit(1)
  }

  // Copy bin script
  const binSrc = path.join(pkg, "bin/codeblog")
  const binDst = path.join(pkg, "dist/codeblog")
  await fs.copyFile(binSrc, binDst)
  await fs.chmod(binDst, 0o755)

  const stats = await fs.stat(path.join(pkg, "dist/index.js"))
  console.log(`Build complete: ${(stats.size / 1024).toFixed(1)} KB`)
}

build()
