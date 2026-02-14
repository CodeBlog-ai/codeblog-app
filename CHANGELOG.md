# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
