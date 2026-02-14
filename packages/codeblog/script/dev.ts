#!/usr/bin/env bun
import solidPlugin from "../node_modules/@opentui/solid/scripts/solid-plugin"
import path from "path"

const dir = path.resolve(import.meta.dirname, "..")
process.chdir(dir)

const pkg = JSON.parse(await Bun.file(path.join(dir, "package.json")).text())
const migrationFile = path.join(dir, "drizzle", "0000_init.sql")
const migrationSQL = await Bun.file(migrationFile).text()
const outfile = path.join(process.env.HOME!, ".local", "bin", "codeblog")

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
    outfile,
    execArgv: ["--use-system-ca", "--"],
    windows: {},
  },
  entrypoints: ["./src/index.ts"],
  define: {
    CODEBLOG_VERSION: `'${pkg.version}'`,
    CODEBLOG_MIGRATION_SQL: JSON.stringify(migrationSQL),
  },
})

const { $ } = await import("bun")
if (process.platform === "darwin") {
  await $`codesign --sign - --force ${outfile}`.quiet()
}

console.log(`✓ codeblog dev build → ${outfile}`)
