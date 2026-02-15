import { createSignal } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useTheme, THEME_NAMES, THEMES } from "../context/theme"

// High-contrast colors that are visible on ANY terminal background
const HC = {
  title: "#ff6600",
  text: "#888888",
  selected: "#00cc00",
  dim: "#999999",
}

export function ThemeSetup() {
  const theme = useTheme()
  const modes = ["dark", "light"] as const
  type ThemePalette = (typeof THEMES)[string]
  const modeAt = (idx: number) => modes[idx] || modes[0]
  const themeAt = (idx: number) => THEME_NAMES[idx] || "codeblog"
  const colorsAt = (name: string): ThemePalette => THEMES[name] || THEMES.codeblog!
  const [step, setStep] = createSignal<"mode" | "theme">("mode")
  const [modeIdx, setModeIdx] = createSignal(0)
  const [themeIdx, setThemeIdx] = createSignal(0)

  useKeyboard((evt) => {
    if (step() === "mode") {
      if (evt.name === "up" || evt.name === "k") {
        setModeIdx((i) => (i - 1 + modes.length) % modes.length)
        evt.preventDefault()
        return
      }
      if (evt.name === "down" || evt.name === "j") {
        setModeIdx((i) => (i + 1) % modes.length)
        evt.preventDefault()
        return
      }
      if (evt.name === "return") {
        theme.setMode(modeAt(modeIdx()))
        setStep("theme")
        evt.preventDefault()
        return
      }
    }

    if (step() === "theme") {
      if (evt.name === "up" || evt.name === "k") {
        const next = (themeIdx() - 1 + THEME_NAMES.length) % THEME_NAMES.length
        setThemeIdx(next)
        theme.set(themeAt(next))
        evt.preventDefault()
        return
      }
      if (evt.name === "down" || evt.name === "j") {
        const next = (themeIdx() + 1) % THEME_NAMES.length
        setThemeIdx(next)
        theme.set(themeAt(next))
        evt.preventDefault()
        return
      }
      if (evt.name === "return") {
        theme.finishSetup()
        evt.preventDefault()
        return
      }
      if (evt.name === "escape") {
        setStep("mode")
        evt.preventDefault()
        return
      }
    }
  })

  return (
    <box flexDirection="column" flexGrow={1} alignItems="center" paddingLeft={2} paddingRight={2}>
      <box flexGrow={1} minHeight={0} />

      <box flexShrink={0} flexDirection="column" alignItems="center">
        <text fg={HC.title}>
          <span style={{ bold: true }}>{"★ Welcome to CodeBlog ★"}</span>
        </text>
        <box height={1} />
      </box>

      {step() === "mode" ? (
        <box flexShrink={0} flexDirection="column" width="100%" maxWidth={50}>
          <text fg={HC.title}>
            <span style={{ bold: true }}>{"What is your terminal background color?"}</span>
          </text>
          <box height={1} />
          {modes.map((m, i) => (
            <box flexDirection="row" paddingLeft={2}>
              <text fg={modeIdx() === i ? HC.selected : HC.dim}>
                {modeIdx() === i ? "❯ " : "  "}
              </text>
              <text fg={modeIdx() === i ? HC.selected : HC.dim}>
                <span style={{ bold: modeIdx() === i }}>
                  {m === "dark" ? "Dark background  (black/dark terminal)" : "Light background (white/light terminal)"}
                </span>
              </text>
            </box>
          ))}
          <box height={1} />
          <text fg={HC.text}>{"↑↓ select · Enter confirm"}</text>
        </box>
      ) : (
        <box flexShrink={0} flexDirection="column" width="100%" maxWidth={60}>
          <text fg={theme.colors.text}>
            <span style={{ bold: true }}>{"Choose a color theme:"}</span>
          </text>
          <box height={1} />
          {THEME_NAMES.map((name, i) => {
            const def = colorsAt(name)
            const c = def[theme.mode] || def.light
            return (
              <box flexDirection="row" paddingLeft={2}>
                <text fg={themeIdx() === i ? c.primary : theme.colors.textMuted}>
                  {themeIdx() === i ? "❯ " : "  "}
                </text>
                <text fg={themeIdx() === i ? c.text : theme.colors.textMuted}>
                  <span style={{ bold: themeIdx() === i }}>
                    {name.padEnd(14)}
                  </span>
                </text>
                <text fg={c.logo1}>{" ●"}</text>
                <text fg={c.logo2}>{"●"}</text>
                <text fg={c.primary}>{"●"}</text>
                <text fg={c.accent}>{"●"}</text>
                <text fg={c.success}>{"●"}</text>
                <text fg={c.error}>{"●"}</text>
              </box>
            )
          })}
          <box height={1} />
          <text fg={theme.colors.textMuted}>{"↑↓ select · Enter confirm · Esc back"}</text>
        </box>
      )}

      <box flexGrow={1} minHeight={0} />
    </box>
  )
}

export function ThemePicker(props: { onDone: () => void }) {
  const theme = useTheme()
  type ThemePalette = (typeof THEMES)[string]
  const themeAt = (i: number) => THEME_NAMES[i] || "codeblog"
  const colorsAt = (name: string): ThemePalette => THEMES[name] || THEMES.codeblog!
  const initialIdx = Math.max(0, THEME_NAMES.indexOf(theme.name))
  const [idx, setIdx] = createSignal(initialIdx)
  const [tab, setTab] = createSignal<"theme" | "mode">("theme")

  useKeyboard((evt) => {
    if (tab() === "theme") {
      if (evt.name === "up" || evt.name === "k") {
        const next = (idx() - 1 + THEME_NAMES.length) % THEME_NAMES.length
        setIdx(next)
        theme.set(themeAt(next))
        evt.preventDefault()
        return
      }
      if (evt.name === "down" || evt.name === "j") {
        const next = (idx() + 1) % THEME_NAMES.length
        setIdx(next)
        theme.set(themeAt(next))
        evt.preventDefault()
        return
      }
      if (evt.name === "tab") {
        setTab("mode")
        evt.preventDefault()
        return
      }
      if (evt.name === "return" || evt.name === "escape") {
        props.onDone()
        evt.preventDefault()
        return
      }
    }

    if (tab() === "mode") {
      if (evt.name === "up" || evt.name === "down" || evt.name === "k" || evt.name === "j") {
        theme.setMode(theme.mode === "dark" ? "light" : "dark")
        evt.preventDefault()
        return
      }
      if (evt.name === "tab") {
        setTab("theme")
        evt.preventDefault()
        return
      }
      if (evt.name === "return" || evt.name === "escape") {
        props.onDone()
        evt.preventDefault()
        return
      }
    }
  })

  return (
    <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2} paddingTop={1}>
      <box flexDirection="row" gap={4} flexShrink={0}>
        <text fg={theme.colors.primary}>
          <span style={{ bold: true }}>Theme Settings</span>
        </text>
        <box flexGrow={1} />
        <text fg={theme.colors.textMuted}>{"Tab: switch section · Enter/Esc: done"}</text>
      </box>

      <box flexDirection="row" flexGrow={1} paddingTop={1} gap={4}>
        {/* Theme list */}
        <box flexDirection="column" width={40}>
          <text fg={tab() === "theme" ? theme.colors.text : theme.colors.textMuted}>
            <span style={{ bold: true }}>{"Color Theme"}</span>
          </text>
          <box height={1} />
          {THEME_NAMES.map((name, i) => {
            const def = colorsAt(name)
            const c = def[theme.mode] || def.light
            return (
              <box flexDirection="row">
                <text fg={idx() === i ? c.primary : theme.colors.textMuted}>
                  {idx() === i && tab() === "theme" ? "❯ " : "  "}
                </text>
                <text fg={idx() === i ? c.text : theme.colors.textMuted}>
                  <span style={{ bold: idx() === i }}>
                    {name.padEnd(14)}
                  </span>
                </text>
                <text fg={c.logo1}>{" ●"}</text>
                <text fg={c.logo2}>{"●"}</text>
                <text fg={c.primary}>{"●"}</text>
                <text fg={c.accent}>{"●"}</text>
                <text fg={c.success}>{"●"}</text>
                <text fg={c.error}>{"●"}</text>
              </box>
            )
          })}
        </box>

        {/* Mode toggle */}
        <box flexDirection="column" width={30}>
          <text fg={tab() === "mode" ? theme.colors.text : theme.colors.textMuted}>
            <span style={{ bold: true }}>{"Background Mode"}</span>
          </text>
          <box height={1} />
          <box flexDirection="row">
            <text fg={theme.mode === "dark" && tab() === "mode" ? theme.colors.primary : theme.colors.textMuted}>
              {theme.mode === "dark" && tab() === "mode" ? "❯ " : "  "}
            </text>
            <text fg={theme.mode === "dark" ? theme.colors.text : theme.colors.textMuted}>
              <span style={{ bold: theme.mode === "dark" }}>{"Dark"}</span>
            </text>
          </box>
          <box flexDirection="row">
            <text fg={theme.mode === "light" && tab() === "mode" ? theme.colors.primary : theme.colors.textMuted}>
              {theme.mode === "light" && tab() === "mode" ? "❯ " : "  "}
            </text>
            <text fg={theme.mode === "light" ? theme.colors.text : theme.colors.textMuted}>
              <span style={{ bold: theme.mode === "light" }}>{"Light"}</span>
            </text>
          </box>
        </box>
      </box>
    </box>
  )
}
