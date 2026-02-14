import { createSignal } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useTheme, THEME_NAMES, THEMES } from "../context/theme"

export function ThemeSetup() {
  const theme = useTheme()
  const modes = ["dark", "light"] as const
  const [step, setStep] = createSignal<"mode" | "theme">("mode")
  const [modeIdx, setModeIdx] = createSignal(0)
  const [themeIdx, setThemeIdx] = createSignal(0)

  useKeyboard((evt) => {
    if (step() === "mode") {
      if (evt.name === "up" || evt.name === "k") {
        setModeIdx((i) => (i - 1 + modes.length) % modes.length)
        theme.setMode(modes[(modeIdx() - 1 + modes.length) % modes.length])
        evt.preventDefault()
        return
      }
      if (evt.name === "down" || evt.name === "j") {
        setModeIdx((i) => (i + 1) % modes.length)
        theme.setMode(modes[(modeIdx() + 1) % modes.length])
        evt.preventDefault()
        return
      }
      if (evt.name === "return") {
        theme.setMode(modes[modeIdx()])
        setStep("theme")
        evt.preventDefault()
        return
      }
    }

    if (step() === "theme") {
      if (evt.name === "up" || evt.name === "k") {
        setThemeIdx((i) => (i - 1 + THEME_NAMES.length) % THEME_NAMES.length)
        theme.set(THEME_NAMES[(themeIdx() - 1 + THEME_NAMES.length) % THEME_NAMES.length])
        evt.preventDefault()
        return
      }
      if (evt.name === "down" || evt.name === "j") {
        setThemeIdx((i) => (i + 1) % THEME_NAMES.length)
        theme.set(THEME_NAMES[(themeIdx() + 1) % THEME_NAMES.length])
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
        <text fg={theme.colors.primary}>
          <span style={{ bold: true }}>Welcome to CodeBlog</span>
        </text>
        <box height={1} />
        <text fg={theme.colors.textMuted}>Let's set up your terminal theme</text>
        <box height={1} />
      </box>

      {step() === "mode" ? (
        <box flexShrink={0} flexDirection="column" width="100%" maxWidth={50}>
          <text fg={theme.colors.text}>
            <span style={{ bold: true }}>Step 1: Is your terminal background dark or light?</span>
          </text>
          <box height={1} />
          {modes.map((m, i) => (
            <box flexDirection="row" paddingLeft={2}>
              <text fg={modeIdx() === i ? theme.colors.primary : theme.colors.textMuted}>
                {modeIdx() === i ? "❯ " : "  "}
              </text>
              <text fg={modeIdx() === i ? theme.colors.text : theme.colors.textMuted}>
                <span style={{ bold: modeIdx() === i }}>
                  {m === "dark" ? "🌙 Dark background" : "☀️  Light background"}
                </span>
              </text>
            </box>
          ))}
          <box height={1} />
          <text fg={theme.colors.textMuted}>↑↓ to select · Enter to confirm</text>
        </box>
      ) : (
        <box flexShrink={0} flexDirection="column" width="100%" maxWidth={50}>
          <text fg={theme.colors.text}>
            <span style={{ bold: true }}>Step 2: Choose a color theme</span>
          </text>
          <box height={1} />
          {THEME_NAMES.map((name, i) => {
            const def = THEMES[name]
            const c = def[theme.mode]
            return (
              <box flexDirection="row" paddingLeft={2}>
                <text fg={themeIdx() === i ? c.primary : theme.colors.textMuted}>
                  {themeIdx() === i ? "❯ " : "  "}
                </text>
                <text fg={themeIdx() === i ? c.text : theme.colors.textMuted}>
                  <span style={{ bold: themeIdx() === i }}>{name}</span>
                </text>
                <text fg={c.logo1}>{" ●"}</text>
                <text fg={c.logo2}>{"●"}</text>
                <text fg={c.primary}>{"●"}</text>
                <text fg={c.success}>{"●"}</text>
                <text fg={c.error}>{"●"}</text>
              </box>
            )
          })}
          <box height={1} />
          <text fg={theme.colors.textMuted}>↑↓ to select · Enter to confirm · Esc to go back</text>
        </box>
      )}

      <box flexGrow={1} minHeight={0} />
    </box>
  )
}
