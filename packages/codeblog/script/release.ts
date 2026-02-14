#!/usr/bin/env bun

import { $ } from "bun"
import path from "path"

const dir = path.resolve(import.meta.dirname, "..")
process.chdir(dir)

const version = process.argv[2]
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error("Usage: bun run script/release.ts <version>")
  console.error("Example: bun run script/release.ts 1.5.0")
  process.exit(1)
}

const pkg = JSON.parse(await Bun.file("package.json").text())
const current = pkg.version
console.log(`\n  Releasing codeblog-app: ${current} → ${version}\n`)

// Step 1: Update version in package.json + optionalDependencies
console.log("1. Updating version...")
pkg.version = version
if (pkg.optionalDependencies) {
  for (const key of Object.keys(pkg.optionalDependencies)) {
    if (key.startsWith("codeblog-app-")) {
      pkg.optionalDependencies[key] = version
    }
  }
}
await Bun.file("package.json").write(JSON.stringify(pkg, null, 2) + "\n")
console.log("   ✓ package.json")

// Step 2: Build all platforms
console.log("\n2. Building all platforms...")
await $`bun run script/build.ts`

// Step 3: Publish platform packages first, then main package
console.log("\n3. Publishing to npm...")
const platforms = ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "windows-x64"]
for (const p of platforms) {
  const name = `codeblog-app-${p}`
  console.log(`   Publishing ${name}@${version}...`)
  await $`npm publish --access public`.cwd(`dist/${name}`)
  console.log(`   ✓ ${name}`)
}

console.log(`   Publishing codeblog-app@${version}...`)
await $`npm publish --access public`.cwd(dir)
console.log(`   ✓ codeblog-app`)

// Step 4: Git commit + tag + push
console.log("\n4. Git commit & push...")
const root = path.resolve(dir, "../..")
await $`git add -A`.cwd(root)
await $`git commit -m ${"release: v" + version}`.cwd(root)
await $`git tag ${"v" + version}`.cwd(root)
await $`git push origin main --tags`.cwd(root)
console.log(`   ✓ Tagged v${version}`)

console.log(`\n  ✅ codeblog-app@${version} released!\n`)
