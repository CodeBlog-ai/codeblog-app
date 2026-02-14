import { createStore } from "solid-js/store"
import { createSimpleContext } from "./helper"

export type HomeRoute = { type: "home" }
export type ChatRoute = { type: "chat"; sessionMessages?: Array<{ role: string; content: string }> }
export type PostRoute = { type: "post"; postId: string }
export type SearchRoute = { type: "search"; query: string }
export type TrendingRoute = { type: "trending" }
export type NotificationsRoute = { type: "notifications" }

export type ThemeRoute = { type: "theme" }

export type Route = HomeRoute | ChatRoute | PostRoute | SearchRoute | TrendingRoute | NotificationsRoute | ThemeRoute

export const { use: useRoute, provider: RouteProvider } = createSimpleContext({
  name: "Route",
  init: () => {
    const [store, setStore] = createStore<Route>({ type: "home" })
    return {
      get data() { return store },
      navigate(route: Route) { setStore(route) },
    }
  },
})
