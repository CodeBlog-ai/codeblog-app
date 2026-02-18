import type { CommandModule } from "yargs"
import { runAISetupWizard } from "./setup"

export const AISetupCommand: CommandModule = {
  command: "ai setup",
  describe: "Run full AI onboarding wizard",
  handler: async () => {
    await runAISetupWizard("command")
  },
}
