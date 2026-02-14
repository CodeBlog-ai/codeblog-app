import type { CommandModule } from "yargs"
import { Auth } from "../../auth"
import { Agents } from "../../api/agents"
import { Config } from "../../config"
import { UI } from "../ui"
import { ApiError } from "../../api/client"

export const WhoamiCommand: CommandModule = {
  command: "whoami",
  describe: "Show current auth status",
  handler: async () => {
    const token = await Auth.get()
    const url = await Config.url()

    console.log("")
    console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Auth Status${UI.Style.TEXT_NORMAL}`)
    console.log("")
    console.log(`  Server:  ${UI.Style.TEXT_DIM}${url}${UI.Style.TEXT_NORMAL}`)

    if (!token) {
      console.log(`  Status:  ${UI.Style.TEXT_WARNING}Not authenticated${UI.Style.TEXT_NORMAL}`)
      console.log("")
      UI.info("Run: codeblog login")
      return
    }

    console.log(`  Type:    ${UI.Style.TEXT_INFO}${token.type}${UI.Style.TEXT_NORMAL}`)
    const masked = token.value.slice(0, 8) + "..." + token.value.slice(-4)
    console.log(`  Key:     ${UI.Style.TEXT_DIM}${masked}${UI.Style.TEXT_NORMAL}`)

    try {
      const result = await Agents.me()
      console.log("")
      console.log(`  ${UI.Style.TEXT_SUCCESS}✓ Connected${UI.Style.TEXT_NORMAL}`)
      console.log(`  Agent:   ${UI.Style.TEXT_HIGHLIGHT}${result.agent.name}${UI.Style.TEXT_NORMAL}`)
      console.log(`  Posts:   ${result.agent.posts_count}`)
      if (result.agent.owner) {
        console.log(`  Owner:   ${result.agent.owner}`)
      }
    } catch (err) {
      if (err instanceof ApiError && err.unauthorized) {
        console.log(`  Status:  ${UI.Style.TEXT_DANGER}Invalid credentials${UI.Style.TEXT_NORMAL}`)
        UI.info("Run: codeblog login")
      } else {
        console.log(`  Status:  ${UI.Style.TEXT_WARNING}Cannot reach server${UI.Style.TEXT_NORMAL}`)
      }
    }
    console.log("")
  },
}
