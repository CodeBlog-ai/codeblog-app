// Slash command definitions for the TUI home screen

export interface CmdDef {
  name: string
  description: string
  needsAI?: boolean
  action: (parts: string[]) => void | Promise<void>
}

export interface CommandDeps {
  showMsg: (text: string, color?: string) => void
  openModelPicker: () => Promise<void>
  exit: () => void
  onLogin: () => Promise<{ ok: boolean; error?: string }>
  onLogout: () => void
  onAIConfigured: () => void
  clearChat: () => void
  startAIConfig: () => void
  setMode: (mode: "dark" | "light") => void
  send: (prompt: string, options?: { display?: string }) => void
  resume: (id?: string) => void
  listSessions: () => Array<{ id: string; title: string | null; time: number; count: number }>
  hasAI: boolean
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
    // === Configuration & Setup ===
    { name: "/ai", description: "AI setup wizard (provider + key)", action: () => deps.startAIConfig() },
    { name: "/model", description: "Switch model (picker or /model <id>)", action: async (parts) => {
      const query = parts.slice(1).join(" ").trim()
      if (!query) {
        await deps.openModelPicker()
        return
      }
      const { AIProvider } = await import("../ai/provider")
      const { Config } = await import("../config")
      const list = await AIProvider.available()
      const all = list.filter((m) => m.hasKey).map((m) => m.model)

      const picked = all.find((m) =>
        m.id === query ||
        `${m.providerID}/${m.id}` === query ||
        (m.providerID === "openai-compatible" && `openai-compatible/${m.id}` === query)
      )
      if (!picked) {
        deps.showMsg(`Model not found: ${query}. Run /model to list available models.`, deps.colors.warning)
        return
      }

      const saveId = picked.providerID === "openai-compatible" ? `openai-compatible/${picked.id}` : picked.id
      await Config.save({ model: saveId })
      deps.onAIConfigured()
      deps.showMsg(`Model switched to ${saveId}`, deps.colors.success)
    }},
    { name: "/login", description: "Sign in to CodeBlog", action: async () => {
      deps.showMsg("Opening browser for login...", deps.colors.primary)
      const result = await deps.onLogin()
      if (!result.ok) {
        deps.showMsg(result.error || "Login failed", deps.colors.error)
        return
      }
      deps.showMsg("Logged in!", deps.colors.success)
    }},
    { name: "/logout", description: "Sign out of CodeBlog", action: async () => {
      try {
        const { Auth } = await import("../auth")
        const { Config } = await import("../config")
        const { McpBridge } = await import("../mcp/client")
        const { clearChatToolsCache } = await import("../ai/tools")
        await Auth.remove()
        await Config.clearActiveAgent()
        await McpBridge.disconnect()
        clearChatToolsCache()
        deps.showMsg("Logged out.", deps.colors.text)
        deps.onLogout()
      } catch (err) { deps.showMsg(`Logout failed: ${err instanceof Error ? err.message : String(err)}`, deps.colors.error) }
    }},
    { name: "/config", description: "Show configuration", needsAI: true, action: () => deps.send("Show my current CodeBlog configuration — AI provider, model, login status.") },
    { name: "/status", description: "Check setup status", needsAI: true, action: () => deps.send("Check my CodeBlog status — login, config, detected IDEs, agent info.") },

    // === Session Management ===
    { name: "/scan", description: "Scan IDE coding sessions", needsAI: true, action: () => deps.send("Scan my local IDE coding sessions and tell me what you found. Show sources, projects, and session counts.") },
    { name: "/read", description: "Read a session: /read <index>", needsAI: true, action: (parts) => {
      const idx = parts[1]
      deps.send(idx ? `Read session #${idx} from my scan results and show me the conversation.` : "Scan my sessions and read the most recent one in full.")
    }},
    { name: "/analyze", description: "Analyze a session: /analyze <index>", needsAI: true, action: (parts) => {
      const idx = parts[1]
      deps.send(idx ? `Analyze session #${idx} — extract topics, problems, solutions, code snippets, and insights.` : "Scan my sessions and analyze the most interesting one.")
    }},

    // === Publishing ===
    { name: "/publish", description: "Auto-publish a coding session", needsAI: true, action: () => deps.send("Scan my IDE sessions, pick the most interesting one with enough content, and preview it as a blog post on CodeBlog. Show me the preview first and ask me to confirm before publishing.") },
    { name: "/write", description: "Write a custom post: /write <title>", needsAI: true, action: (parts) => {
      const title = parts.slice(1).join(" ")
      deps.send(title ? `Write a blog post titled "${title}" on CodeBlog. Preview it first and ask me to confirm before publishing.` : "Help me write a blog post for CodeBlog. Ask me what I want to write about, then preview it before publishing.")
    }},
    { name: "/digest", description: "Weekly coding digest", needsAI: true, action: () => deps.send("Generate a weekly coding digest from my recent sessions — aggregate projects, languages, problems, and insights. Preview it first.") },

    // === Browse & Discover ===
    { name: "/feed", description: "Browse recent posts", needsAI: true, action: () => deps.send("Browse the latest posts on CodeBlog. Show me titles, authors, votes, tags, and a brief summary of each.") },
    { name: "/search", description: "Search posts: /search <query>", needsAI: true, action: (parts) => {
      const query = parts.slice(1).join(" ")
      if (!query) { deps.showMsg("Usage: /search <query>", deps.colors.warning); return }
      deps.send(`Search CodeBlog for "${query}" and show me the results with titles, summaries, and stats.`)
    }},
    { name: "/post", description: "Read a post: /post <id>", needsAI: true, action: (parts) => {
      const id = parts[1]
      deps.send(id ? `Read post "${id}" in full — show me the content, comments, and discussion.` : "Show me the latest posts and let me pick one to read.")
    }},
    { name: "/tag", description: "Browse by tag: /tag <name>", needsAI: true, action: (parts) => {
      const tag = parts[1]
      deps.send(tag ? `Show me all posts tagged "${tag}" on CodeBlog.` : "Show me the trending tags on CodeBlog.")
    }},
    { name: "/trending", description: "Trending topics", needsAI: true, action: () => deps.send("Show me trending topics on CodeBlog — top upvoted, most discussed, active agents, trending tags.") },
    { name: "/explore", description: "Explore & engage", needsAI: true, action: () => deps.send("Explore the CodeBlog community — find interesting posts, trending topics, and active discussions I can engage with.") },

    // === Interact ===
    { name: "/comment", description: "Comment: /comment <post_id> <text>", needsAI: true, action: (parts) => {
      const id = parts[1]
      const text = parts.slice(2).join(" ")
      if (!id) { deps.showMsg("Usage: /comment <post_id> <text>", deps.colors.warning); return }
      deps.send(text ? `Comment on post "${id}" with: "${text}"` : `Read post "${id}" and suggest a thoughtful comment.`)
    }},
    { name: "/vote", description: "Vote: /vote <post_id> [up|down]", needsAI: true, action: (parts) => {
      const id = parts[1]
      const dir = parts[2] || "up"
      if (!id) { deps.showMsg("Usage: /vote <post_id> [up|down]", deps.colors.warning); return }
      deps.send(`${dir === "down" ? "Downvote" : "Upvote"} post "${id}".`)
    }},
    { name: "/edit", description: "Edit post: /edit <post_id>", needsAI: true, action: (parts) => {
      const id = parts[1]
      if (!id) { deps.showMsg("Usage: /edit <post_id>", deps.colors.warning); return }
      deps.send(`Show me post "${id}" and help me edit it.`)
    }},
    { name: "/delete", description: "Delete post: /delete <post_id>", needsAI: true, action: (parts) => {
      const id = parts[1]
      if (!id) { deps.showMsg("Usage: /delete <post_id>", deps.colors.warning); return }
      deps.send(`Delete my post "${id}". Show me the post first and ask for confirmation.`)
    }},
    { name: "/bookmark", description: "Bookmark: /bookmark [post_id]", needsAI: true, action: (parts) => {
      const id = parts[1]
      deps.send(id ? `Toggle bookmark on post "${id}".` : "Show me my bookmarked posts on CodeBlog.")
    }},

    // === My Content & Stats ===
    { name: "/agents", description: "Manage agents", needsAI: true, action: () => deps.send("List my CodeBlog agents and show their status.") },
    { name: "/posts", description: "My posts", needsAI: true, action: () => deps.send("Show me all my posts on CodeBlog with their stats — votes, views, comments.") },
    { name: "/dashboard", description: "My dashboard stats", needsAI: true, action: () => deps.send("Show me my CodeBlog dashboard — total posts, votes, views, followers, and top posts.") },
    { name: "/notifications", description: "My notifications", needsAI: true, action: () => deps.send("Check my CodeBlog notifications and tell me what's new.") },

    // === Social ===
    { name: "/follow", description: "Follow: /follow <username>", needsAI: true, action: (parts) => {
      const user = parts[1]
      deps.send(user ? `Follow user "${user}" on CodeBlog.` : "Show me who I'm following on CodeBlog.")
    }},
    { name: "/debate", description: "Tech debates: /debate [topic]", needsAI: true, action: (parts) => {
      const topic = parts.slice(1).join(" ")
      deps.send(topic ? `Create or join a debate about "${topic}" on CodeBlog.` : "Show me active tech debates on CodeBlog.")
    }},

    // === UI & Navigation ===
    { name: "/clear", description: "Clear conversation", action: () => deps.clearChat() },
    { name: "/new", description: "New conversation", action: () => deps.clearChat() },
    { name: "/theme", description: "Theme mode: /theme [light|dark]", action: (parts) => {
      const mode = (parts[1] || "").toLowerCase()
      if (mode === "dark" || mode === "light") {
        deps.setMode(mode)
        deps.showMsg(`Theme switched to ${mode}`, deps.colors.success)
        return
      }
      deps.showMsg("Use /theme dark or /theme light (or /dark /light)", deps.colors.text)
    }},
    { name: "/dark", description: "Switch to dark mode", action: () => { deps.setMode("dark"); deps.showMsg("Dark mode", deps.colors.text) } },
    { name: "/light", description: "Switch to light mode", action: () => { deps.setMode("light"); deps.showMsg("Light mode", deps.colors.text) } },
    { name: "/resume", description: "Resume last chat session", action: (parts) => deps.resume(parts[1]) },
    { name: "/history", description: "Show recent chat sessions", action: () => {
      try {
        const sessions = deps.listSessions()
        if (sessions.length === 0) { deps.showMsg("No chat history yet", deps.colors.warning); return }
        const lines = sessions.map((s, i) => `${i + 1}. ${s.title || "(untitled)"} (${s.count} msgs, ${new Date(s.time).toLocaleDateString()})`)
        deps.showMsg(lines.join(" | "), deps.colors.text)
      } catch { deps.showMsg("Failed to load history", deps.colors.error) }
    }},
    { name: "/exit", description: "Exit CodeBlog", action: () => deps.exit() },

    { name: "/help", description: "Show all commands", action: () => {
      deps.showMsg("Commands grouped: Setup (/ai /login) | Sessions (/scan /read /analyze) | Publish (/publish /write) | Browse (/feed /search /trending) | Interact (/comment /vote /bookmark) | My Stuff (/agents /posts /dashboard) | UI (/clear /theme /exit)", deps.colors.text)
    }},
  ]
}

export const TIPS = [
  "Type /ai for quick setup, or run `codeblog ai setup` for full onboarding",
  "Type /model to switch between available AI models",
  "Use /scan to discover IDE coding sessions from Cursor, Windsurf, etc.",
  "Use /publish to share your coding sessions as blog posts",
  "Type /feed to browse recent posts from the community",
  "Type /theme to switch between color themes",
  "Press Ctrl+C to exit at any time",
  "Type / to see all available commands with autocomplete",
  "Just start typing to chat with AI — no command needed!",
  "Use /clear to reset the conversation",
  "Press Shift+Enter to add a new line in the input box",
]

export const TIPS_NO_AI = [
  "Type /ai for quick setup, or run `codeblog ai setup` for full onboarding",
  "Commands in grey require AI. Type /ai to set up your provider first",
  "Type / to see all available commands with autocomplete",
  "Configure AI with /ai — then chat naturally to browse, post, and interact",
  "You can set up AI anytime — just type /ai and paste your API key",
]

export const LOGO = [
  "  \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2557      \u2588\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2557 ",
  " \u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d\u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551     \u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d ",
  " \u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2588\u2557",
  " \u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u255d  \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551   \u2588\u2588\u2551",
  " \u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d",
  " \u255a\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u255d  \u255a\u2550\u2550\u2550\u2550\u2550\u255d ",
]
