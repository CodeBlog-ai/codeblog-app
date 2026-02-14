import { createStore } from "solid-js/store"
import { createSimpleContext } from "./helper"

export type ThemeColors = {
  text: string
  textMuted: string
  primary: string
  accent: string
  success: string
  error: string
  warning: string
  input: string
  cursor: string
  logo1: string
  logo2: string
}

type ThemeDef = {
  dark: ThemeColors
  light: ThemeColors
}

const codeblog: ThemeDef = {
  dark: {
    text: "#e7e9eb",
    textMuted: "#6a737c",
    primary: "#0074cc",
    accent: "#f48225",
    success: "#48a868",
    error: "#d73a49",
    warning: "#f48225",
    input: "#e7e9eb",
    cursor: "#6a737c",
    logo1: "#f48225",
    logo2: "#0074cc",
  },
  light: {
    text: "#232629",
    textMuted: "#6a737c",
    primary: "#0074cc",
    accent: "#f48225",
    success: "#2ea44f",
    error: "#cf222e",
    warning: "#bf8700",
    input: "#232629",
    cursor: "#838c95",
    logo1: "#f48225",
    logo2: "#0074cc",
  },
}

const dracula: ThemeDef = {
  dark: {
    text: "#f8f8f2",
    textMuted: "#6272a4",
    primary: "#bd93f9",
    accent: "#ff79c6",
    success: "#50fa7b",
    error: "#ff5555",
    warning: "#f1fa8c",
    input: "#f8f8f2",
    cursor: "#6272a4",
    logo1: "#ff79c6",
    logo2: "#bd93f9",
  },
  light: {
    text: "#282a36",
    textMuted: "#6272a4",
    primary: "#7c3aed",
    accent: "#db2777",
    success: "#16a34a",
    error: "#dc2626",
    warning: "#ca8a04",
    input: "#282a36",
    cursor: "#6272a4",
    logo1: "#db2777",
    logo2: "#7c3aed",
  },
}

const nord: ThemeDef = {
  dark: {
    text: "#eceff4",
    textMuted: "#4c566a",
    primary: "#88c0d0",
    accent: "#81a1c1",
    success: "#a3be8c",
    error: "#bf616a",
    warning: "#ebcb8b",
    input: "#eceff4",
    cursor: "#4c566a",
    logo1: "#88c0d0",
    logo2: "#81a1c1",
  },
  light: {
    text: "#2e3440",
    textMuted: "#4c566a",
    primary: "#5e81ac",
    accent: "#81a1c1",
    success: "#a3be8c",
    error: "#bf616a",
    warning: "#d08770",
    input: "#2e3440",
    cursor: "#4c566a",
    logo1: "#5e81ac",
    logo2: "#81a1c1",
  },
}

const tokyonight: ThemeDef = {
  dark: {
    text: "#c0caf5",
    textMuted: "#565f89",
    primary: "#7aa2f7",
    accent: "#bb9af7",
    success: "#9ece6a",
    error: "#f7768e",
    warning: "#e0af68",
    input: "#c0caf5",
    cursor: "#565f89",
    logo1: "#bb9af7",
    logo2: "#7aa2f7",
  },
  light: {
    text: "#343b58",
    textMuted: "#6172b0",
    primary: "#2e7de9",
    accent: "#9854f1",
    success: "#587539",
    error: "#f52a65",
    warning: "#8c6c3e",
    input: "#343b58",
    cursor: "#6172b0",
    logo1: "#9854f1",
    logo2: "#2e7de9",
  },
}

const monokai: ThemeDef = {
  dark: {
    text: "#f8f8f2",
    textMuted: "#75715e",
    primary: "#66d9ef",
    accent: "#f92672",
    success: "#a6e22e",
    error: "#f92672",
    warning: "#e6db74",
    input: "#f8f8f2",
    cursor: "#75715e",
    logo1: "#f92672",
    logo2: "#66d9ef",
  },
  light: {
    text: "#272822",
    textMuted: "#75715e",
    primary: "#0089b3",
    accent: "#c4265e",
    success: "#718c00",
    error: "#c4265e",
    warning: "#c99e00",
    input: "#272822",
    cursor: "#75715e",
    logo1: "#c4265e",
    logo2: "#0089b3",
  },
}

const github: ThemeDef = {
  dark: {
    text: "#c9d1d9",
    textMuted: "#8b949e",
    primary: "#58a6ff",
    accent: "#bc8cff",
    success: "#3fb950",
    error: "#f85149",
    warning: "#d29922",
    input: "#c9d1d9",
    cursor: "#8b949e",
    logo1: "#58a6ff",
    logo2: "#bc8cff",
  },
  light: {
    text: "#24292f",
    textMuted: "#57606a",
    primary: "#0969da",
    accent: "#8250df",
    success: "#1a7f37",
    error: "#cf222e",
    warning: "#9a6700",
    input: "#24292f",
    cursor: "#57606a",
    logo1: "#0969da",
    logo2: "#8250df",
  },
}

const solarized: ThemeDef = {
  dark: {
    text: "#839496",
    textMuted: "#586e75",
    primary: "#268bd2",
    accent: "#d33682",
    success: "#859900",
    error: "#dc322f",
    warning: "#b58900",
    input: "#93a1a1",
    cursor: "#586e75",
    logo1: "#cb4b16",
    logo2: "#268bd2",
  },
  light: {
    text: "#657b83",
    textMuted: "#93a1a1",
    primary: "#268bd2",
    accent: "#d33682",
    success: "#859900",
    error: "#dc322f",
    warning: "#b58900",
    input: "#586e75",
    cursor: "#93a1a1",
    logo1: "#cb4b16",
    logo2: "#268bd2",
  },
}

export const THEMES: Record<string, ThemeDef> = {
  codeblog,
  dracula,
  nord,
  tokyonight,
  monokai,
  github,
  solarized,
}

export const THEME_NAMES = Object.keys(THEMES)

function detect(): "dark" | "light" {
  const env = process.env.COLORFGBG
  if (env) {
    const parts = env.split(";")
    const bg = parseInt(parts[parts.length - 1] || "0", 10)
    if (bg > 6 && bg !== 8) return "light"
  }
  return "dark"
}

export const { use: useTheme, provider: ThemeProvider } = createSimpleContext({
  name: "Theme",
  init: () => {
    const [store, setStore] = createStore({
      name: "codeblog" as string,
      mode: detect() as "dark" | "light",
    })

    return {
      get colors(): ThemeColors {
        const def = THEMES[store.name] || THEMES.codeblog
        return def[store.mode]
      },
      get name() { return store.name },
      get mode() { return store.mode },
      set(name: string) {
        if (THEMES[name]) setStore("name", name)
      },
      toggle() {
        setStore("mode", store.mode === "dark" ? "light" : "dark")
      },
      setMode(mode: "dark" | "light") {
        setStore("mode", mode)
      },
    }
  },
})
