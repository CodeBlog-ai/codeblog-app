#!/usr/bin/env bun

import { $ } from "bun"
import path from "path"
import fs from "fs"

const dir = path.resolve(import.meta.dirname, "..")
const root = path.resolve(dir, "../..")
process.chdir(dir)

const version = process.argv[2]
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error("Usage: bun run script/release.ts <version>")
  console.error("Example: bun run script/release.ts 1.5.0")
  process.exit(1)
}

const platforms = ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "windows-x64"]
const pkg = JSON.parse(await Bun.file("package.json").text())
const prev = pkg.version
const tag = `v${version}`
const date = new Date().toISOString().split("T")[0]

console.log(`\n  codeblog-app  ${prev} → ${version}\n`)
console.log("─".repeat(50))

// ─── Step 1: Bump version ────────────────────────
console.log("\n1. Bumping version...")

// package.json
pkg.version = version
for (const key of Object.keys(pkg.optionalDependencies || {})) {
  if (key.startsWith("codeblog-app-")) pkg.optionalDependencies[key] = version
}
await Bun.file("package.json").write(JSON.stringify(pkg, null, 2) + "\n")
console.log("   ✓ package.json")

// README.md — update version example
const readme = path.join(root, "README.md")
if (fs.existsSync(readme)) {
  let text = await Bun.file(readme).text()
  // Update "codeblog --version" output example
  text = text.replace(/# \d+\.\d+\.\d+/g, `# ${version}`)
  // Update platform badge to include Windows
  text = text.replace(
    /platform-macOS%20%7C%20Linux/g,
    "platform-macOS%20%7C%20Linux%20%7C%20Windows",
  )
  await Bun.file(readme).write(text)
  console.log("   ✓ README.md")
}

// CHANGELOG.md — prepend new version section with commit messages
const changelog = path.join(root, "CHANGELOG.md")
if (fs.existsSync(changelog)) {
  let text = await Bun.file(changelog).text()

  // Collect commit messages since last tag for changelog content
  let changes: string[] = []
  try {
    const lastTag = (await $`git describe --tags --abbrev=0`.cwd(root).text()).trim()
    const log = (await $`git log ${lastTag}..HEAD --oneline --no-decorate`.cwd(root).text()).trim()
    changes = log.split("\n").filter(Boolean).map((line) => line.replace(/^[a-f0-9]+ /, ""))
  } catch {
    changes = []
  }

  // Categorize commits by conventional commit prefix
  const added: string[] = []
  const fixed: string[] = []
  const changed: string[] = []

  for (const msg of changes) {
    if (/^feat[:(]/i.test(msg)) added.push(msg.replace(/^feat[:(]\s*[^)]*\)?:?\s*/i, ""))
    else if (/^fix[:(]/i.test(msg)) fixed.push(msg.replace(/^fix[:(]\s*[^)]*\)?:?\s*/i, ""))
    else if (/^(chore|refactor|perf|docs|style|build|ci)[:(]/i.test(msg))
      changed.push(msg.replace(/^(chore|refactor|perf|docs|style|build|ci)[:(]\s*[^)]*\)?:?\s*/i, ""))
    else if (!/^release/i.test(msg)) changed.push(msg)
  }

  const sections: string[] = [`## [${version}] - ${date}`]
  if (added.length > 0) {
    sections.push("", "### Added", ...added.map((m) => `- ${m}`))
  }
  if (fixed.length > 0) {
    sections.push("", "### Fixed", ...fixed.map((m) => `- ${m}`))
  }
  if (changed.length > 0) {
    sections.push("", "### Changed", ...changed.map((m) => `- ${m}`))
  }
  if (added.length === 0 && fixed.length === 0 && changed.length === 0) {
    sections.push("", "### Changed", "- Internal improvements and dependency updates")
  }

  const entry = sections.join("\n")
  text = text.replace("## [Unreleased]", `## [Unreleased]\n\n${entry}\n`)
  await Bun.file(changelog).write(text)
  console.log("   ✓ CHANGELOG.md")
}

// ─── Step 2: Build all platforms ─────────────────
console.log("\n2. Building all platforms...")
await $`bun run script/build.ts`

// ─── Step 3: Publish to npm ──────────────────────
console.log("\n3. Publishing to npm...")

for (const p of platforms) {
  const name = `codeblog-app-${p}`
  console.log(`   ${name}@${version}...`)
  await $`npm publish --access public --fetch-timeout=300000`.cwd(`dist/${name}`)
  console.log(`   ✓ ${name}`)
}

console.log(`   codeblog-app@${version}...`)
await $`npm publish --access public --fetch-timeout=300000`.cwd(dir)
console.log(`   ✓ codeblog-app`)

// ─── Step 4: Package binaries for GitHub Release ─
console.log("\n4. Packaging release assets...")
await $`mkdir -p dist/release`.cwd(dir)

for (const p of platforms) {
  const name = `codeblog-app-${p}`
  const archive = p.startsWith("linux")
    ? `codeblog-${version}-${p}.tar.gz`
    : `codeblog-${version}-${p}.zip`

  if (p.startsWith("linux")) {
    await $`tar -czf ${path.join(dir, "dist/release", archive)} *`.cwd(path.join(dir, `dist/${name}/bin`))
  } else {
    await $`zip -j dist/release/${archive} dist/${name}/bin/*`.cwd(dir)
  }
  console.log(`   ✓ ${archive}`)
}

// ─── Step 5: Git commit + tag + push ─────────────
console.log("\n5. Git commit & tag...")
await $`git add -A`.cwd(root)
await $`git commit -m ${"release: " + tag}`.cwd(root)
await $`git tag -a ${tag} -m ${"codeblog-app " + tag}`.cwd(root)
await $`git push origin main --tags`.cwd(root)
console.log(`   ✓ ${tag} pushed`)

// ─── Step 6: GitHub Release ──────────────────────
console.log("\n6. Creating GitHub Release...")

// Collect commit messages since previous tag for release notes
let releaseChanges: string[] = []
try {
  const prevTag = (await $`git describe --tags --abbrev=0 ${tag}^`.cwd(root).text()).trim()
  const log = (await $`git log ${prevTag}..${tag}^ --oneline --no-decorate`.cwd(root).text()).trim()
  releaseChanges = log.split("\n").filter(Boolean).map((line) =>
    `- ${line.replace(/^[a-f0-9]+ /, "")}`
  )
} catch {
  releaseChanges = ["- See CHANGELOG.md for details"]
}

const notes = [
  `## codeblog-app ${tag}`,
  "",
  "### Changes",
  ...releaseChanges,
  "",
  "### Install",
  "```bash",
  "curl -fsSL https://codeblog.ai/install.sh | bash",
  "```",
  "Or: `npm install -g codeblog-app`",
  "",
  "### Platform binaries",
  ...platforms.map((p) => {
    const ext = p.startsWith("linux") ? "tar.gz" : "zip"
    return `- \`codeblog-${version}-${p}.${ext}\``
  }),
].join("\n")

const notesFile = path.join(dir, "dist/release/notes.md")
await Bun.file(notesFile).write(notes)

try {
  await $`gh release create ${tag} dist/release/codeblog-${version}-*.* --title ${tag} --notes-file ${notesFile}`.cwd(dir)
  console.log(`   ✓ GitHub Release ${tag} created with ${platforms.length} assets`)
} catch {
  console.log("   ⚠ gh CLI not available or failed — upload assets manually:")
  console.log(`     gh release create ${tag} dist/release/codeblog-${version}-*.*`)
}

// ─── Step 7: Post-release verification ──────────
console.log("\n7. Post-release verification...")

// 7a. Verify npm registry has the new version
const maxRetries = 10
let npmVerified = false
for (let i = 1; i <= maxRetries; i++) {
  try {
    const res = await fetch("https://registry.npmjs.org/codeblog-app/latest")
    const data = await res.json() as { version: string }
    if (data.version === version) {
      console.log(`   ✓ npm registry: codeblog-app@${version}`)
      npmVerified = true
      break
    }
    console.log(`   ⏳ npm registry shows ${data.version}, waiting... (${i}/${maxRetries})`)
  } catch {
    console.log(`   ⏳ npm registry check failed, retrying... (${i}/${maxRetries})`)
  }
  await Bun.sleep(3000)
}
if (!npmVerified) {
  console.log("   ⚠ npm registry not yet updated — may take a few minutes to propagate")
}

// 7b. Verify install.sh would fetch correct version
try {
  const res = await fetch("https://registry.npmjs.org/codeblog-app/latest")
  const data = await res.json() as { version: string }
  if (data.version === version) {
    console.log(`   ✓ install.sh (codeblog.ai/install.sh) will install v${version}`)
  } else {
    console.log(`   ⚠ install.sh would install v${data.version} (expected v${version})`)
  }
} catch {
  console.log("   ⚠ Could not verify install.sh version")
}

// 7c. Verify codeblog.ai/install.ps1 has Windows compatibility guards
try {
  const remote = await fetch("https://codeblog.ai/install.ps1").then((r) => r.text())
  const local = await Bun.file(path.join(root, "install.ps1")).text()
  const normRemote = remote.replaceAll("\r\n", "\n")
  const normLocal = local.replaceAll("\r\n", "\n")
  if (normRemote === normLocal) {
    console.log("   ✓ install.ps1 is synced to codeblog.ai")
  } else {
    console.log("   ⚠ install.ps1 on codeblog.ai differs from repository install.ps1")
  }
  const guard = [
    "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12",
    "$env:PROCESSOR_ARCHITECTURE",
  ].every((s) => normRemote.includes(s))
  if (guard) {
    console.log("   ✓ install.ps1 includes TLS 1.2 + architecture fallback guards")
  } else {
    console.log("   ⚠ install.ps1 is missing TLS/architecture guards needed for PowerShell 5.1")
  }
} catch {
  console.log("   ⚠ Could not verify codeblog.ai/install.ps1")
}

// 7d. Verify platform packages
for (const p of platforms) {
  try {
    const res = await fetch(`https://registry.npmjs.org/codeblog-app-${p}/latest`)
    const data = await res.json() as { version: string }
    if (data.version === version) {
      console.log(`   ✓ codeblog-app-${p}@${version}`)
    } else {
      console.log(`   ⚠ codeblog-app-${p}@${data.version} (expected ${version})`)
    }
  } catch {
    console.log(`   ⚠ Could not verify codeblog-app-${p}`)
  }
}

// ─── Step 8: Cleanup build artifacts ────────────
console.log("\n8. Cleaning up build artifacts...")
const distDir = path.join(dir, "dist")
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true })
  console.log("   ✓ dist/ removed")
}
const tsBuildInfo = path.join(dir, "tsconfig.tsbuildinfo")
if (fs.existsSync(tsBuildInfo)) {
  fs.rmSync(tsBuildInfo)
  console.log("   ✓ tsconfig.tsbuildinfo removed")
}
const rootTsBuildInfo = path.join(root, "tsconfig.tsbuildinfo")
if (fs.existsSync(rootTsBuildInfo)) {
  fs.rmSync(rootTsBuildInfo)
  console.log("   ✓ root tsconfig.tsbuildinfo removed")
}

// ─── Done ────────────────────────────────────────
console.log("\n" + "─".repeat(50))
console.log(`\n  ✅ codeblog-app@${version} released!`)
console.log("")
console.log("  Published:")
console.log(`    npm: codeblog-app@${version} + ${platforms.length} platform packages`)
console.log(`    git: ${tag} (annotated tag)`)
console.log(`    gh:  https://github.com/CodeBlog-ai/codeblog-app/releases/tag/${tag}`)
console.log("")
console.log("  Install:")
console.log("    curl -fsSL https://codeblog.ai/install.sh | bash")
console.log("")
