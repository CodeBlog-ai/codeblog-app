import path from "path"
import fs from "fs"
import { createStore } from "solid-js/store"
import { createSimpleContext } from "./helper"
import { Global } from "../../global"

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

const catppuccin: ThemeDef = {
  dark: {
    text: "#cdd6f4",
    textMuted: "#6c7086",
    primary: "#89b4fa",
    accent: "#cba6f7",
    success: "#a6e3a1",
    error: "#f38ba8",
    warning: "#f9e2af",
    input: "#cdd6f4",
    cursor: "#6c7086",
    logo1: "#cba6f7",
    logo2: "#89b4fa",
  },
  light: {
    text: "#4c4f69",
    textMuted: "#8c8fa1",
    primary: "#1e66f5",
    accent: "#8839ef",
    success: "#40a02b",
    error: "#d20f39",
    warning: "#df8e1d",
    input: "#4c4f69",
    cursor: "#8c8fa1",
    logo1: "#8839ef",
    logo2: "#1e66f5",
  },
}

const rosepine: ThemeDef = {
  dark: {
    text: "#e0def4",
    textMuted: "#6e6a86",
    primary: "#c4a7e7",
    accent: "#ebbcba",
    success: "#31748f",
    error: "#eb6f92",
    warning: "#f6c177",
    input: "#e0def4",
    cursor: "#6e6a86",
    logo1: "#ebbcba",
    logo2: "#c4a7e7",
  },
  light: {
    text: "#575279",
    textMuted: "#9893a5",
    primary: "#907aa9",
    accent: "#d7827e",
    success: "#286983",
    error: "#b4637a",
    warning: "#ea9d34",
    input: "#575279",
    cursor: "#9893a5",
    logo1: "#d7827e",
    logo2: "#907aa9",
  },
}

const gruvbox: ThemeDef = {
  dark: {
    text: "#ebdbb2",
    textMuted: "#928374",
    primary: "#83a598",
    accent: "#d3869b",
    success: "#b8bb26",
    error: "#fb4934",
    warning: "#fabd2f",
    input: "#ebdbb2",
    cursor: "#928374",
    logo1: "#fe8019",
    logo2: "#83a598",
  },
  light: {
    text: "#3c3836",
    textMuted: "#928374",
    primary: "#076678",
    accent: "#8f3f71",
    success: "#79740e",
    error: "#9d0006",
    warning: "#b57614",
    input: "#3c3836",
    cursor: "#928374",
    logo1: "#af3a03",
    logo2: "#076678",
  },
}

const onedark: ThemeDef = {
  dark: {
    text: "#abb2bf",
    textMuted: "#5c6370",
    primary: "#61afef",
    accent: "#c678dd",
    success: "#98c379",
    error: "#e06c75",
    warning: "#e5c07b",
    input: "#abb2bf",
    cursor: "#5c6370",
    logo1: "#e06c75",
    logo2: "#61afef",
  },
  light: {
    text: "#383a42",
    textMuted: "#a0a1a7",
    primary: "#4078f2",
    accent: "#a626a4",
    success: "#50a14f",
    error: "#e45649",
    warning: "#c18401",
    input: "#383a42",
    cursor: "#a0a1a7",
    logo1: "#e45649",
    logo2: "#4078f2",
  },
}

const kanagawa: ThemeDef = {
  dark: {
    text: "#dcd7ba",
    textMuted: "#727169",
    primary: "#7e9cd8",
    accent: "#957fb8",
    success: "#76946a",
    error: "#c34043",
    warning: "#dca561",
    input: "#dcd7ba",
    cursor: "#727169",
    logo1: "#ff5d62",
    logo2: "#7e9cd8",
  },
  light: {
    text: "#1f1f28",
    textMuted: "#8a8980",
    primary: "#4e8ca2",
    accent: "#624c83",
    success: "#6f894e",
    error: "#c84053",
    warning: "#cc6d00",
    input: "#1f1f28",
    cursor: "#8a8980",
    logo1: "#d7474b",
    logo2: "#4e8ca2",
  },
}

const everforest: ThemeDef = {
  dark: {
    text: "#d3c6aa",
    textMuted: "#859289",
    primary: "#7fbbb3",
    accent: "#d699b6",
    success: "#a7c080",
    error: "#e67e80",
    warning: "#dbbc7f",
    input: "#d3c6aa",
    cursor: "#859289",
    logo1: "#e69875",
    logo2: "#7fbbb3",
  },
  light: {
    text: "#5c6a72",
    textMuted: "#939f91",
    primary: "#3a94c5",
    accent: "#df69ba",
    success: "#8da101",
    error: "#f85552",
    warning: "#dfa000",
    input: "#5c6a72",
    cursor: "#939f91",
    logo1: "#f57d26",
    logo2: "#3a94c5",
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
  catppuccin,
  rosepine,
  gruvbox,
  onedark,
  kanagawa,
  everforest,
}

export const THEME_NAMES = Object.keys(THEMES)
const DEFAULT_THEME: ThemeDef = codeblog

const configPath = path.join(Global.Path.config, "theme.json")

type SavedTheme = { name: string; mode: "dark" | "light" }

function load(): SavedTheme | null {
  try {
    const data = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    if (data.name && data.mode) return data as SavedTheme
  } catch {}
  return null
}

function save(cfg: SavedTheme) {
  Bun.write(configPath, JSON.stringify(cfg, null, 2)).catch(() => {})
}

export const { use: useTheme, provider: ThemeProvider } = createSimpleContext({
  name: "Theme",
  init: () => {
    const saved = load()
    const [store, setStore] = createStore({
      name: saved?.name || "codeblog",
      mode: (saved?.mode || "light") as "dark" | "light",
      needsSetup: !saved,
    })

    return {
      get colors(): ThemeColors {
        const def = THEMES[store.name] ?? DEFAULT_THEME
        return def[store.mode]
      },
      get name() { return store.name },
      get mode() { return store.mode },
      get needsSetup() { return store.needsSetup },
      set(name: string) {
        if (!THEMES[name]) return
        setStore("name", name)
        save({ name, mode: store.mode })
      },
      setMode(mode: "dark" | "light") {
        setStore("mode", mode)
        save({ name: store.name, mode })
      },
      finishSetup() {
        setStore("needsSetup", false)
        save({ name: store.name, mode: store.mode })
      },
    }
  },
})
