#!/usr/bin/env bun

import solidPlugin from "../node_modules/@opentui/solid/scripts/solid-plugin"
import path from "path"
import fs from "fs"
import { $ } from "bun"

const dir = path.resolve(import.meta.dirname, "..")
process.chdir(dir)

const pkg = JSON.parse(await Bun.file(path.join(dir, "package.json")).text())
const version = pkg.version

// Load migration SQL
const migrationFile = path.join(dir, "drizzle", "0000_init.sql")
const migrationSQL = await Bun.file(migrationFile).text()

const singleFlag = process.argv.includes("--single")

const allTargets: { os: string; arch: "arm64" | "x64" }[] = [
  { os: "darwin", arch: "arm64" },
  { os: "darwin", arch: "x64" },
  { os: "linux", arch: "arm64" },
  { os: "linux", arch: "x64" },
  { os: "win32", arch: "x64" },
]

const targets = singleFlag
  ? allTargets.filter((t) => t.os === process.platform && t.arch === process.arch)
  : allTargets

await $`rm -rf dist`

// Install platform-specific native deps for cross-compilation
if (!singleFlag) {
  await $`bun install --os="*" --cpu="*" @opentui/core@${pkg.dependencies["@opentui/core"]}`
}

for (const item of targets) {
  const name = [
    "codeblog-app",
    item.os === "win32" ? "windows" : item.os,
    item.arch,
  ].join("-")

  console.log(`building ${name}...`)
  await $`mkdir -p dist/${name}/bin`

  const binary = item.os === "win32" ? "codeblog.exe" : "codeblog"

  await Bun.build({
    conditions: ["browser"],
    tsconfig: "./tsconfig.json",
    plugins: [solidPlugin],
    sourcemap: "none",
    compile: {
      autoloadBunfig: false,
      autoloadDotenv: false,
      // @ts-ignore
      autoloadTsconfig: true,
      autoloadPackageJson: true,
      target: name.replace("codeblog-app", "bun") as any,
      outfile: `dist/${name}/bin/${binary}`,
      execArgv: ["--use-system-ca", "--"],
      windows: {},
    },
    entrypoints: ["./src/index.ts"],
    define: {
      CODEBLOG_VERSION: `'${version}'`,
      CODEBLOG_MIGRATION_SQL: JSON.stringify(migrationSQL),
    },
  })

  // Write platform package.json
  await Bun.file(`dist/${name}/package.json`).write(
    JSON.stringify(
      {
        name,
        version,
        description: `CodeBlog CLI binary for ${item.os} ${item.arch}`,
        os: [item.os],
        cpu: [item.arch],
        bin: { codeblog: `bin/${binary}` },
      },
      null,
      2,
    ),
  )

  console.log(`  ✓ ${name}`)
}

// Create main wrapper package
await $`mkdir -p dist/codeblog-app`
const optionalDeps: Record<string, string> = {}
for (const item of targets) {
  const name = [
    "codeblog-app",
    item.os === "win32" ? "windows" : item.os,
    item.arch,
  ].join("-")
  optionalDeps[name] = version
}

await Bun.file("dist/codeblog-app/package.json").write(
  JSON.stringify(
    {
      name: "codeblog-app",
      version,
      description: "CLI client for CodeBlog — the forum where AI writes the posts",
      license: "MIT",
      author: "CodeBlog-ai",
      homepage: "https://github.com/CodeBlog-ai/codeblog-app",
      repository: { type: "git", url: "https://github.com/CodeBlog-ai/codeblog-app" },
      bin: { codeblog: "bin/codeblog" },
      optionalDependencies: optionalDeps,
    },
    null,
    2,
  ),
)

// Copy the launcher script
await $`mkdir -p dist/codeblog-app/bin`
await Bun.file("dist/codeblog-app/bin/codeblog").write(
  await Bun.file(path.join(dir, "bin", "codeblog")).text(),
)
await $`chmod +x dist/codeblog-app/bin/codeblog`

console.log("")
console.log(`Built ${targets.length} platform binaries for v${version}`)
console.log("")

// If --publish flag, publish all packages
if (process.argv.includes("--publish")) {
  for (const item of targets) {
    const name = [
      "codeblog-app",
      item.os === "win32" ? "windows" : item.os,
      item.arch,
    ].join("-")
    console.log(`Publishing ${name}@${version}...`)
    await $`npm publish --access public`.cwd(`dist/${name}`)
  }
  console.log(`Publishing codeblog-app@${version}...`)
  await $`npm publish --access public`.cwd(`dist/codeblog-app`)
  console.log("All packages published!")
}
