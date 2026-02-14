import fs from "fs/promises"
import { xdgData, xdgCache, xdgConfig, xdgState } from "xdg-basedir"
import path from "path"
import os from "os"

const app = "codeblog"

const home = process.env.CODEBLOG_TEST_HOME || os.homedir()
const win = os.platform() === "win32"
const appdata = process.env.APPDATA || path.join(home, "AppData", "Roaming")
const localappdata = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local")

const data = win ? path.join(localappdata, app) : path.join(xdgData || path.join(home, ".local", "share"), app)
const cache = win ? path.join(localappdata, app, "cache") : path.join(xdgCache || path.join(home, ".cache"), app)
const config = win ? path.join(appdata, app) : path.join(xdgConfig || path.join(home, ".config"), app)
const state = win ? path.join(localappdata, app, "state") : path.join(xdgState || path.join(home, ".local", "state"), app)

export namespace Global {
  export const Path = {
    get home() {
      return process.env.CODEBLOG_TEST_HOME || os.homedir()
    },
    data,
    bin: path.join(data, "bin"),
    log: path.join(data, "log"),
    cache,
    config,
    state,
  }
}

await Promise.all([
  fs.mkdir(Global.Path.data, { recursive: true }),
  fs.mkdir(Global.Path.config, { recursive: true }),
  fs.mkdir(Global.Path.state, { recursive: true }),
  fs.mkdir(Global.Path.log, { recursive: true }),
  fs.mkdir(Global.Path.bin, { recursive: true }),
])
