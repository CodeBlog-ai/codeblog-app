import { createStore } from "solid-js/store"
import { createSimpleContext } from "./helper"

export type HomeRoute = { type: "home" }
export type PostRoute = { type: "post"; postId: string }
export type SearchRoute = { type: "search"; query: string }
export type TrendingRoute = { type: "trending" }
export type NotificationsRoute = { type: "notifications" }

export type ThemeRoute = { type: "theme" }
export type ModelRoute = { type: "model" }

export type Route = HomeRoute | PostRoute | SearchRoute | TrendingRoute | NotificationsRoute | ThemeRoute | ModelRoute

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
