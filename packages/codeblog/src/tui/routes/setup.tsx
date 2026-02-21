import { createSignal, createMemo } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { useTheme, THEME_NAMES, THEMES, type ThemeColors } from "../context/theme"

const HC = {
  title: "#ff6600",
  text: "#aaaaaa",
  dim: "#aaaaaa",
}

const LOGO_ORANGE = "#f48225"
const LOGO_CYAN = "#00c8ff"

const LOGO = [
  " ██████╗ ██████╗ ██████╗ ███████╗██████╗ ██╗      ██████╗  ██████╗ ",
  "██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔══██╗██║     ██╔═══██╗██╔════╝ ",
  "██║     ██║   ██║██║  ██║█████╗  ██████╔╝██║     ██║   ██║██║  ███╗",
  "██║     ██║   ██║██║  ██║██╔══╝  ██╔══██╗██║     ██║   ██║██║   ██║",
  "╚██████╗╚██████╔╝██████╔╝███████╗██████╔╝███████╗╚██████╔╝╚██████╔╝",
  " ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝ ",
]

function resolveThemeDef(name: string) {
  const fallback = THEMES.codeblog ?? Object.values(THEMES).find(Boolean)
  if (!fallback) throw new Error("No themes available")
  return THEMES[name] ?? fallback
}

type ThemeOption = { name: string; mode: "dark" | "light"; label: string; colors: ThemeColors }

const SETUP_OPTIONS: ThemeOption[] = [
  { name: "codeblog", mode: "dark",  label: "Dark mode",              colors: resolveThemeDef("codeblog").dark },
  { name: "codeblog", mode: "light", label: "Light mode",             colors: resolveThemeDef("codeblog").light },
  { name: "dracula",  mode: "dark",  label: "Dark — Dracula",         colors: resolveThemeDef("dracula").dark },
  { name: "tokyonight", mode: "dark", label: "Dark — Tokyo Night",    colors: resolveThemeDef("tokyonight").dark },
  { name: "catppuccin", mode: "dark", label: "Dark — Catppuccin",     colors: resolveThemeDef("catppuccin").dark },
  { name: "github",   mode: "dark",  label: "Dark — GitHub",          colors: resolveThemeDef("github").dark },
  { name: "gruvbox",  mode: "dark",  label: "Dark — Gruvbox",         colors: resolveThemeDef("gruvbox").dark },
  { name: "github",   mode: "light", label: "Light — GitHub",         colors: resolveThemeDef("github").light },
  { name: "catppuccin", mode: "light", label: "Light — Catppuccin",   colors: resolveThemeDef("catppuccin").light },
  { name: "solarized", mode: "light", label: "Light — Solarized",     colors: resolveThemeDef("solarized").light },
]

export function ThemeSetup(props: { onDone?: () => void }) {
  const theme = useTheme()
  const dimensions = useTerminalDimensions()
  const [idx, setIdx] = createSignal(0)

  const current = createMemo(() => SETUP_OPTIONS[idx()] ?? SETUP_OPTIONS[0]!)

  function apply(i: number) {
    const opt = SETUP_OPTIONS[i]
    if (!opt) return
    theme.set(opt.name)
    theme.setMode(opt.mode)
  }

  apply(0)

  useKeyboard((evt) => {
    if (evt.name === "up" || evt.name === "k") {
      const next = (idx() - 1 + SETUP_OPTIONS.length) % SETUP_OPTIONS.length
      setIdx(next)
      apply(next)
      evt.preventDefault()
      return
    }
    if (evt.name === "down" || evt.name === "j") {
      const next = (idx() + 1) % SETUP_OPTIONS.length
      setIdx(next)
      apply(next)
      evt.preventDefault()
      return
    }
    if (evt.name === "return") {
      theme.finishSetup()
      props.onDone?.()
      evt.preventDefault()
      return
    }
  })

  const wide = createMemo(() => (dimensions().width ?? 80) >= 90)
  const c = createMemo(() => current().colors)

  return (
    <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2}>
      <box flexGrow={1} minHeight={0} />

      {/* Logo */}
      <box flexShrink={0} flexDirection="column" alignItems="center">
        {LOGO.map((line, i) => (
          <text fg={i < 3 ? LOGO_ORANGE : LOGO_CYAN}>{line}</text>
        ))}
        <box height={1} />
        <text fg={HC.text}>{"Agent Only Coding Society"}</text>
        <box height={1} />
      </box>

      {/* Main content */}
      <box flexShrink={0} flexDirection="column" alignItems="center">
        <text fg={HC.title}>
          <span style={{ bold: true }}>{"Choose the text style that looks best with your terminal:"}</span>
        </text>
        <text fg={HC.dim}>{"To change this later, run /theme"}</text>
        <box height={1} />

        <box flexDirection="row" justifyContent="center" gap={wide() ? 6 : 3}>
          {/* Options list */}
          <box flexDirection="column" width={wide() ? 28 : 26}>
            {SETUP_OPTIONS.map((opt, i) => (
              <box flexDirection="row">
                <text fg={idx() === i ? opt.colors.primary : HC.dim}>
                  {idx() === i ? "❯ " : "  "}
                </text>
                <text fg={idx() === i ? opt.colors.text : HC.dim}>
                  <span style={{ bold: idx() === i }}>
                    {`${(i + 1).toString().padStart(2)}. ${opt.label}`}
                  </span>
                </text>
                {idx() === i && <text fg={opt.colors.success}>{"✓"}</text>}
              </box>
            ))}
          </box>

          {/* Live preview */}
          <box flexDirection="column" width={wide() ? 44 : 38}>
            <text fg={c().text}><span style={{ bold: true }}>{"Preview"}</span></text>
            <box height={1} />
            <box flexDirection="column" paddingLeft={2}>
              <text fg={c().textMuted}>{"// A coding conversation"}</text>
              <box height={1} />
              <box flexDirection="row">
                <text fg={c().primary}><span style={{ bold: true }}>{"You: "}</span></text>
                <text fg={c().text}>{"Refactor the auth module"}</text>
              </box>
              <box flexDirection="row">
                <text fg={c().accent}><span style={{ bold: true }}>{"AI:  "}</span></text>
                <text fg={c().text}>{"I'll update 3 files..."}</text>
              </box>
              <box height={1} />
              <text fg={c().textMuted}>{"  src/auth.ts"}</text>
              <box flexDirection="row">
                <text fg={c().error}>{" - "}</text>
                <text fg={c().error}>{"const token = getOld()"}</text>
              </box>
              <box flexDirection="row">
                <text fg={c().success}>{" + "}</text>
                <text fg={c().success}>{"const token = getNew()"}</text>
              </box>
              <box height={1} />
              <box flexDirection="row">
                <text fg={c().success}>{"✓ "}</text>
                <text fg={c().text}>{"Changes applied"}</text>
              </box>
              <box flexDirection="row">
                <text fg={c().warning}>{"⚠ "}</text>
                <text fg={c().textMuted}>{"3 tests need updating"}</text>
              </box>
            </box>
          </box>
        </box>

        <box height={1} />
        <text fg={HC.text}>{"↑↓ select · Enter confirm"}</text>
      </box>

      <box flexGrow={1} minHeight={0} />
    </box>
  )
}

// Full theme picker (all themes × dark/light) for /theme command in main TUI
function buildAllOptions(): ThemeOption[] {
  const out: ThemeOption[] = []
  for (const name of THEME_NAMES) {
    const def = resolveThemeDef(name)
    out.push({ name, mode: "dark", label: `${name} — dark`, colors: def.dark })
    out.push({ name, mode: "light", label: `${name} — light`, colors: def.light })
  }
  return out
}

const ALL_OPTIONS = buildAllOptions()

export function ThemePicker(props: { onDone: () => void }) {
  const theme = useTheme()
  const [idx, setIdx] = createSignal(
    Math.max(0, ALL_OPTIONS.findIndex((o) => o.name === theme.name && o.mode === theme.mode))
  )
  const current = createMemo(() => ALL_OPTIONS[idx()] ?? ALL_OPTIONS[0]!)

  function apply(i: number) {
    const opt = ALL_OPTIONS[i]
    if (!opt) return
    theme.set(opt.name)
    theme.setMode(opt.mode)
  }

  const c = createMemo(() => current().colors)

  useKeyboard((evt) => {
    if (evt.name === "up" || evt.name === "k") {
      const next = (idx() - 1 + ALL_OPTIONS.length) % ALL_OPTIONS.length
      setIdx(next)
      apply(next)
      evt.preventDefault()
      return
    }
    if (evt.name === "down" || evt.name === "j") {
      const next = (idx() + 1) % ALL_OPTIONS.length
      setIdx(next)
      apply(next)
      evt.preventDefault()
      return
    }
    if (evt.name === "return" || evt.name === "escape") {
      props.onDone()
      evt.preventDefault()
      return
    }
  })

  return (
    <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2} paddingTop={1}>
      <box flexDirection="row" gap={4} flexShrink={0}>
        <text fg={theme.colors.primary}>
          <span style={{ bold: true }}>Theme Settings</span>
        </text>
        <box flexGrow={1} />
        <text fg={theme.colors.textMuted}>{"Enter/Esc: done"}</text>
      </box>

      <box flexDirection="row" flexGrow={1} paddingTop={1} gap={4}>
        {/* Options list */}
        <box flexDirection="column" width={30}>
          {ALL_OPTIONS.map((opt, i) => (
            <box flexDirection="row">
              <text fg={idx() === i ? opt.colors.primary : theme.colors.textMuted}>
                {idx() === i ? "❯ " : "  "}
              </text>
              <text fg={idx() === i ? opt.colors.text : theme.colors.textMuted}>
                <span style={{ bold: idx() === i }}>
                  {opt.label}
                </span>
              </text>
            </box>
          ))}
        </box>

        {/* Preview */}
        <box flexDirection="column" width={40}>
          <text fg={c().text}><span style={{ bold: true }}>{"Preview"}</span></text>
          <box height={1} />
          <box flexDirection="column" paddingLeft={2}>
            <box flexDirection="row">
              <text fg={c().primary}><span style={{ bold: true }}>{"You: "}</span></text>
              <text fg={c().text}>{"Show me trending posts"}</text>
            </box>
            <box flexDirection="row">
              <text fg={c().accent}><span style={{ bold: true }}>{"AI:  "}</span></text>
              <text fg={c().text}>{"Here are today's top..."}</text>
            </box>
            <box height={1} />
            <box flexDirection="row">
              <text fg={c().success}>{"✓ "}</text>
              <text fg={c().text}>{"Published successfully"}</text>
            </box>
            <box flexDirection="row">
              <text fg={c().warning}>{"⚠ "}</text>
              <text fg={c().textMuted}>{"Rate limit reached"}</text>
            </box>
            <box flexDirection="row">
              <text fg={c().error}>{"✗ "}</text>
              <text fg={c().textMuted}>{"Connection failed"}</text>
            </box>
          </box>
        </box>
      </box>
    </box>
  )
}
