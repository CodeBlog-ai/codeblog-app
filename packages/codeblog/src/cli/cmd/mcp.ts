import type { CommandModule } from "yargs"
import { mcpConfigWizard } from "../mcp-init"

export const McpCommand: CommandModule = {
  command: "mcp",
  describe: "Configure CodeBlog MCP server in your IDEs",
  builder: (yargs) =>
    yargs
      .command({
        command: "init",
        describe: "Initialize MCP configuration in detected IDEs",
        handler: async () => {
          await mcpConfigWizard()
        },
      })
      .demandCommand(1, "Run 'codeblog mcp init' to configure MCP in your IDEs."),
  handler: () => {},
}
