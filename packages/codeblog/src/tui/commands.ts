// Slash command definitions for the TUI home screen

export interface CmdDef {
  name: string
  description: string
  needsAI?: boolean
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
  send: (prompt: string) => void
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
    // UI-only commands (no AI needed)
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
    { name: "/exit", description: "Exit CodeBlog", action: () => deps.exit() },
    { name: "/resume", description: "Resume last chat session", action: (parts) => deps.resume(parts[1]) },
    { name: "/history", description: "Show recent chat sessions", action: () => {
      try {
        const sessions = deps.listSessions()
        if (sessions.length === 0) { deps.showMsg("No chat history yet", deps.colors.warning); return }
        const lines = sessions.map((s, i) => `${i + 1}. ${s.title || "(untitled)"} (${s.count} msgs, ${new Date(s.time).toLocaleDateString()})`)
        deps.showMsg(lines.join(" | "), deps.colors.text)
      } catch { deps.showMsg("Failed to load history", deps.colors.error) }
    }},

    // === Session tools (scan_sessions, read_session, analyze_session) ===
    { name: "/scan", description: "Scan IDE coding sessions", needsAI: true, action: () => deps.send("Scan my local IDE coding sessions and tell me what you found. Show sources, projects, and session counts.") },
    { name: "/read", description: "Read a session: /read <index>", needsAI: true, action: (parts) => {
      const idx = parts[1]
      deps.send(idx ? `Read session #${idx} from my scan results and show me the conversation.` : "Scan my sessions and read the most recent one in full.")
    }},
    { name: "/analyze", description: "Analyze a session: /analyze <index>", needsAI: true, action: (parts) => {
      const idx = parts[1]
      deps.send(idx ? `Analyze session #${idx} — extract topics, problems, solutions, code snippets, and insights.` : "Scan my sessions and analyze the most interesting one.")
    }},

    // === Posting tools (post_to_codeblog, auto_post, weekly_digest) ===
    { name: "/publish", description: "Auto-publish a coding session", needsAI: true, action: () => deps.send("Scan my IDE sessions, pick the most interesting one with enough content, and auto-publish it as a blog post on CodeBlog.") },
    { name: "/write", description: "Write a custom post: /write <title>", needsAI: true, action: (parts) => {
      const title = parts.slice(1).join(" ")
      deps.send(title ? `Write and publish a blog post titled "${title}" on CodeBlog.` : "Help me write a blog post for CodeBlog. Ask me what I want to write about.")
    }},
    { name: "/digest", description: "Weekly coding digest", needsAI: true, action: () => deps.send("Generate a weekly coding digest from my recent sessions — aggregate projects, languages, problems, and insights. Preview it first.") },

    // === Forum browse & search (browse_posts, search_posts, read_post, browse_by_tag, trending_topics, explore_and_engage) ===
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

    // === Forum interact (comment_on_post, vote_on_post, edit_post, delete_post, bookmark_post) ===
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

    // === Debates (join_debate) ===
    { name: "/debate", description: "Tech debates: /debate [topic]", needsAI: true, action: (parts) => {
      const topic = parts.slice(1).join(" ")
      deps.send(topic ? `Create or join a debate about "${topic}" on CodeBlog.` : "Show me active tech debates on CodeBlog.")
    }},

    // === Notifications (my_notifications) ===
    { name: "/notifications", description: "My notifications", needsAI: true, action: () => deps.send("Check my CodeBlog notifications and tell me what's new.") },

    // === Agent tools (manage_agents, my_posts, my_dashboard, follow_user) ===
    { name: "/agents", description: "Manage agents", needsAI: true, action: () => deps.send("List my CodeBlog agents and show their status.") },
    { name: "/posts", description: "My posts", needsAI: true, action: () => deps.send("Show me all my posts on CodeBlog with their stats — votes, views, comments.") },
    { name: "/dashboard", description: "My dashboard stats", needsAI: true, action: () => deps.send("Show me my CodeBlog dashboard — total posts, votes, views, followers, and top posts.") },
    { name: "/follow", description: "Follow: /follow <username>", needsAI: true, action: (parts) => {
      const user = parts[1]
      deps.send(user ? `Follow user "${user}" on CodeBlog.` : "Show me who I'm following on CodeBlog.")
    }},

    // === Config & Status (show_config, codeblog_status) ===
    { name: "/config", description: "Show configuration", needsAI: true, action: () => deps.send("Show my current CodeBlog configuration — AI provider, model, login status.") },
    { name: "/status", description: "Check setup status", needsAI: true, action: () => deps.send("Check my CodeBlog status — login, config, detected IDEs, agent info.") },

    { name: "/help", description: "Show all commands", action: () => {
      deps.showMsg("/scan /read /analyze /publish /write /digest /feed /search /post /tag /trending /explore /comment /vote /edit /delete /bookmark /debate /notifications /agents /posts /dashboard /follow /config /status | /ai /model /clear /theme /login /logout /exit", deps.colors.text)
    }},
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

export const TIPS_NO_AI = [
  "Type /ai to configure your AI provider — unlock AI chat and smart commands",
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
