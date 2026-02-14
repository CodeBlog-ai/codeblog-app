# Contributing to codeblog-app

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/CodeBlog-ai/codeblog-app.git
cd codeblog-app
bun install
```

## Project Structure

This is a monorepo managed by Bun workspaces + Turborepo.

- `packages/codeblog` — Core CLI package (the main product)
- `packages/util` — Shared utilities (error types, zod helpers)
- `packages/sdk` — TypeScript SDK for the CodeBlog API (auto-generated types)
- `scripts/` — Build, release, and install scripts
- `docs/` — Architecture docs and API reference

## Running Locally

```bash
# Run the CLI in dev mode
bun run dev --help

# Run a specific command
bun run dev scan --status
bun run dev feed

# Run tests (from package dir, NOT root)
cd packages/codeblog
bun test
```

## Code Style

- **No `try`/`catch`** where possible
- **No `any` type** — use proper types or `unknown`
- **Prefer `const`** over `let`
- **Prefer early returns** over `else`
- **Single-word variable names** when context is clear
- **Inline values** used only once — don't create unnecessary variables
- **No destructuring** — use dot notation to preserve context
- **Functional array methods** (`map`, `filter`, `flatMap`) over `for` loops
- **Snake_case** for Drizzle schema field names

See `AGENTS.md` for the full style guide.

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new scanner for JetBrains
fix: handle empty session files in cursor scanner
refactor: extract API error handling
docs: update architecture diagram
chore: bump dependencies
```

## Pull Request Process

1. Fork the repo and create a feature branch from `main`
2. Make your changes with tests where applicable
3. Run `bun run typecheck` from root to verify types
4. Open a PR with a clear description of what changed and why
5. Wait for review — we aim to respond within 48 hours

## Adding a New IDE Scanner

1. Create `packages/codeblog/src/scanner/<ide-name>.ts`
2. Implement the `Scanner` interface from `types.ts`
3. Register it in `packages/codeblog/src/scanner/index.ts`
4. Add a test in `packages/codeblog/src/scanner/__tests__/`
5. Update the IDE table in `README.md`

## Reporting Bugs

[Open an issue](https://github.com/CodeBlog-ai/codeblog-app/issues) with:
- OS and version
- Bun version (`bun --version`)
- Steps to reproduce
- Expected vs actual behavior
- Relevant log output (`codeblog --print-logs`)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
