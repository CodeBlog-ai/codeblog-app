// Slash command definitions for the TUI home screen

export interface CmdDef {
  name: string
  description: string
  action: (parts: string[]) => void | Promise<void>
}

export interface CommandDeps {
  showMsg: (text: string, color?: string) => void
  navigate: (route: any) => void
  exit: () => void
  onLogin: () => Promise<void>
  onLogout: () => void
  clearChat: () => void
  startAIConfig: () => void
  setMode: (mode: "dark" | "light") => void
  colors: {
    primary: string
    success: string
    warning: string
    error: string
    text: string
  }
}

export function createCommands(deps: CommandDeps): CmdDef[] {
  return [
    { name: "/ai", description: "Configure AI provider (paste URL + key)", action: () => deps.startAIConfig() },
    { name: "/model", description: "Choose AI model", action: () => deps.navigate({ type: "model" }) },
    { name: "/clear", description: "Clear conversation", action: () => deps.clearChat() },
    { name: "/new", description: "New conversation", action: () => deps.clearChat() },
    { name: "/login", description: "Sign in to CodeBlog", action: async () => {
      deps.showMsg("Opening browser for login...", deps.colors.primary)
      await deps.onLogin()
      deps.showMsg("Logged in!", deps.colors.success)
    }},
    { name: "/logout", description: "Sign out of CodeBlog", action: async () => {
      try {
        const { Auth } = await import("../auth")
        await Auth.remove()
        deps.showMsg("Logged out.", deps.colors.text)
        deps.onLogout()
      } catch (err) { deps.showMsg(`Logout failed: ${err instanceof Error ? err.message : String(err)}`, deps.colors.error) }
    }},
    { name: "/theme", description: "Change color theme", action: () => deps.navigate({ type: "theme" }) },
    { name: "/dark", description: "Switch to dark mode", action: () => { deps.setMode("dark"); deps.showMsg("Dark mode", deps.colors.text) } },
    { name: "/light", description: "Switch to light mode", action: () => { deps.setMode("light"); deps.showMsg("Light mode", deps.colors.text) } },
    { name: "/scan", description: "Scan IDE coding sessions", action: async () => {
      deps.showMsg("Scanning IDE sessions...", deps.colors.primary)
      try {
        const { registerAllScanners, scanAll } = await import("../scanner")
        registerAllScanners()
        const sessions = scanAll(10)
        if (sessions.length === 0) deps.showMsg("No IDE sessions found.", deps.colors.warning)
        else deps.showMsg(`Found ${sessions.length} sessions: ${sessions.slice(0, 3).map((s) => `[${s.source}] ${s.project}`).join(" | ")}`, deps.colors.success)
      } catch (err) { deps.showMsg(`Scan failed: ${err instanceof Error ? err.message : String(err)}`, deps.colors.error) }
    }},
    { name: "/publish", description: "Publish sessions as blog posts", action: async () => {
      deps.showMsg("Publishing sessions...", deps.colors.primary)
      try {
        const { Publisher } = await import("../publisher")
        const results = await Publisher.scanAndPublish({ limit: 1 })
        const ok = results.filter((r) => r.postId)
        deps.showMsg(ok.length > 0 ? `Published ${ok.length} post(s)!` : "No sessions to publish.", ok.length > 0 ? deps.colors.success : deps.colors.warning)
      } catch (err) { deps.showMsg(`Publish failed: ${err instanceof Error ? err.message : String(err)}`, deps.colors.error) }
    }},
    { name: "/feed", description: "Browse recent posts", action: async () => {
      deps.showMsg("Loading feed...", deps.colors.primary)
      try {
        const { Feed } = await import("../api/feed")
        const result = await Feed.list()
        const posts = (result as any).posts || []
        if (posts.length === 0) deps.showMsg("No posts yet.", deps.colors.warning)
        else deps.showMsg(`${posts.length} posts: ${posts.slice(0, 3).map((p: any) => p.title?.slice(0, 40)).join(" | ")}`, deps.colors.text)
      } catch (err) { deps.showMsg(`Feed failed: ${err instanceof Error ? err.message : String(err)}`, deps.colors.error) }
    }},
    { name: "/search", description: "Search posts", action: async (parts) => {
      const query = parts.slice(1).join(" ")
      if (!query) { deps.showMsg("Usage: /search <query>", deps.colors.warning); return }
      try {
        const { Search } = await import("../api/search")
        const result = await Search.query(query)
        const count = result.counts?.posts || 0
        const posts = result.posts || []
        deps.showMsg(count > 0 ? `${count} results for "${query}": ${posts.slice(0, 3).map((p: any) => p.title?.slice(0, 30)).join(" | ")}` : `No results for "${query}"`, count > 0 ? deps.colors.success : deps.colors.warning)
      } catch (err) { deps.showMsg(`Search failed: ${err instanceof Error ? err.message : String(err)}`, deps.colors.error) }
    }},
    { name: "/config", description: "Show current configuration", action: async () => {
      try {
        const { Config } = await import("../config")
        const cfg = await Config.load()
        const providers = cfg.providers || {}
        const keys = Object.keys(providers)
        const model = cfg.model || "claude-sonnet-4-20250514"
        deps.showMsg(`Model: ${model} | Providers: ${keys.length > 0 ? keys.join(", ") : "none"}`, deps.colors.text)
      } catch { deps.showMsg("Failed to load config", deps.colors.error) }
    }},
    { name: "/help", description: "Show all commands", action: () => {
      deps.showMsg("Commands: /ai /model /scan /publish /feed /search /config /clear /theme /login /logout /exit", deps.colors.text)
    }},
    { name: "/exit", description: "Exit CodeBlog", action: () => deps.exit() },
  ]
}

export const TIPS = [
  "Type /ai to configure your AI provider with a URL and API key",
  "Type /model to switch between available AI models",
  "Use /scan to discover IDE coding sessions from Cursor, Windsurf, etc.",
  "Use /publish to share your coding sessions as blog posts",
  "Type /feed to browse recent posts from the community",
  "Type /theme to switch between color themes",
  "Press Ctrl+C to exit at any time",
  "Type / to see all available commands with autocomplete",
  "Just start typing to chat with AI — no command needed!",
  "Use /clear to reset the conversation",
]

export const LOGO = [
  "  \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2557      \u2588\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2557 ",
  " \u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d\u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551     \u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d ",
  " \u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2588\u2557",
  " \u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u255d  \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551   \u2588\u2588\u2551",
  " \u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d",
  " \u255a\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u255d  \u255a\u2550\u2550\u2550\u2550\u2550\u255d ",
]
