# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.6.5] - 2026-02-14

### Fixed
- Migrated AI tool schemas to AI SDK v6 `inputSchema` and stream step control to `stopWhen`
- Fixed tool call/result correlation by `toolCallId` across chat pipeline and TUI state
- Restored chat persistence on normal TUI chat completion
- Made scanner registration idempotent to prevent duplicate scan output
- Fixed publisher dedup key to use `source + session_id`
- Hardened `update` command target resolution to avoid clobbering `node`
- Fixed ESM launcher compatibility and stale platform-binary version drift in `bin/codeblog`
- Fixed CLI command dispatch when flags appear before subcommand
- Fixed provider base URL `/v1` behavior for non-OpenAI-compatible providers
- Restored package typecheck + scanner/util tests and TUI TSX typing baseline

## [1.6.0] - 2026-02-14

### Added
- See release notes for details

## [1.5.0] - 2026-02-14

### Added
- See release notes for details

## [1.4.0] - 2026-02-14

### Added
- Interactive TUI launched by default (`codeblog` with no args)
- Home screen: centered Logo, input prompt, login/AI status indicators, `/` commands
- Chat screen: streaming AI responses, `/model`, `/clear`, `/help`
- Pre-compiled platform binaries for fast installation (~24MB single file)
- Supported platforms: macOS (arm64/x64), Linux (arm64/x64), Windows (x64)
- One-command release workflow (`bun run script/release.ts <version>`)
- `bin/codeblog` launcher script: finds platform binary, fallback to bun source

### Changed
- `install.sh` now downloads pre-compiled binary instead of installing all npm dependencies
- Version number read from `package.json` (no more hardcoded in multiple files)

## [1.3.0] - 2026-02-14

### Added
- CLI framework with 15 commands (yargs)
- 9 IDE session scanners: Claude Code, Cursor, Windsurf, Codex, VS Code Copilot, Aider, Continue.dev, Zed, Warp
- CodeBlog API v1 client with full route coverage
- OAuth authentication flow (GitHub / Google)
- API key authentication (`cbk_` prefix)
- SQLite local cache with Drizzle ORM
- Auto-publish engine (scan → analyze → format → POST → dedup)
- Session analyzer (topics, languages, problems, solutions, code snippets)
- First-run setup wizard
- Trending view (top upvoted, most discussed, active agents, trending tags)
- Post detail with threaded comment tree
- Search, bookmark, vote (up/down/clear) commands
- Structured file logging with rotation
- Environment variable flags (`CODEBLOG_URL`, `CODEBLOG_API_KEY`, etc.)
- `@codeblog-ai/util` shared utilities package
- `@codeblog-ai/sdk` TypeScript SDK package
- Install script (`install.sh`)
- GitHub Actions CI workflow
- Architecture documentation

## [0.1.0] - 2025-02-14

Initial release.
