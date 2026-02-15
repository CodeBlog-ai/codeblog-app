# AGENTS.md

Instructions for AI coding agents working on this repository.

## General

- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- The default branch is `main`.
- Prefer automation: execute requested actions without confirmation unless blocked by missing info or safety/irreversibility.
- Tests cannot run from repo root; run from package dirs like `packages/codeblog`.

## Monorepo Collaboration

This repo (`codeblog-app`) is the **CLI / TUI client**. It works alongside a sibling repo:

| Repo | Path | Description |
|------|------|-------------|
| `codeblog` | `/Users/zhaoyifei/VibeCodingWork/codeblog` | Next.js Web 论坛 + MCP 服务器 |
| `codeblog-app` | `/Users/zhaoyifei/VibeCodingWork/codeblog-app` | CLI/TUI 客户端（本仓库） |

- `codeblog-app` 通过 HTTP API 与 `codeblog` 后端通信（`/api/v1/*` 端点）
- Agent 认证使用 `Authorization: Bearer cbk_...` Token
- 用户认证使用 JWT cookie（OAuth 登录后获取）
- API 基础 URL 可通过 `codeblog config` 命令配置

## Development Environment

### Prerequisites

- **Bun >= 1.3.9** (package manager + runtime)
- macOS / Linux

### Critical: `bunfig.toml`

`packages/codeblog/bunfig.toml` 配置了 `@opentui/solid/preload`，这是 TUI 正常运行的**必要条件**。它做两件事：
1. 用 Babel + `babel-preset-solid` 编译 `.tsx` JSX 为 `@opentui/solid` 调用（Bun 1.x 不支持 `jsxImportSource`，会回退到 `React.createElement`）
2. 将 `solid-js/dist/server.js` 重定向到 `solid-js/dist/solid.js`（client 版本）

**不要删除或修改 `bunfig.toml`**，否则 TUI 会白屏。

### Commands

```bash
bun install                  # 安装依赖（从根目录）
bun run dev                  # 启动 TUI（带 --watch 热重载）
bun run dev -- --help        # 查看 CLI 帮助
bun run dev -- feed          # 运行单个 CLI 命令
bun run build                # 构建发布二进制
bun run typecheck            # 类型检查
```

### Running Tests

```bash
cd packages/codeblog && bun test
cd packages/util && bun test
```

## Style Guide

### General Principles

- Keep things in one function unless composable or reusable
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Prefer single word variable names where possible
- Use Bun APIs when possible, like `Bun.file()`
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Prefer functional array methods (flatMap, filter, map) over for loops; use type guards on filter to maintain type inference downstream

### Naming

Prefer single word names for variables and functions. Only use multiple words if necessary.

```ts
// Good
const foo = 1
function journal(dir: string) {}

// Bad
const fooBar = 1
function prepareJournal(dir: string) {}
```

Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json()

// Bad
const journalPath = path.join(dir, "journal.json")
const journal = await Bun.file(journalPath).json()
```

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```ts
// Good
obj.a
obj.b

// Bad
const { a, b } = obj
```

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2

// Bad
let foo
if (condition) foo = 1
else foo = 2
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
  if (condition) return 1
  return 2
}

// Bad
function foo() {
  if (condition) return 1
  else return 2
}
```

### Schema Definitions (Drizzle)

Use snake_case for field names so column names don't need to be redefined as strings.

```ts
// Good
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
})

// Bad
const table = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
})
```

## Testing

- Avoid mocks as much as possible
- Test actual implementation, do not duplicate logic into tests
- Tests cannot run from repo root; run from package dirs like `packages/codeblog`.
