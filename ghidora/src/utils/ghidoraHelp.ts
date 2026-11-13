import { getRuntime } from "../datatypes/validateDataTypes";

export const ghidoraHelp = (version: string) => {
  return `
GHIDORA  v${version} installed via - ${getRuntime()}

Usage:
  ghidora <task>                 Run configured task (DAG-aware)
  ghidora run <pkg>:<task>       Run task in a single package
  ghidora exec "<command>"       Execute raw command across packages
  ghidora graph                  Generate & serve task graph (HTML)

Flags:
  --scope <pkg>[,<pkg>...]   Limit execution to selected packages
  --no-cache                Disable cache restore/save
  --dry-run                 Print execution plan only
  --no-bail                 Continue execution on errors

Config:
  totalParallelTasks (number)
    Global concurrency limit for all executions.

   executor (bun | deno | pnpm | yarn | npm)
    Gives you freedom of choosing your favourite PM 

Examples:
  ghidora build
  ghidora build --scope tester,rustda
  ghidora test --no-bail
  ghidora exec "npm test"
  ghidora graph

To Report Bugs plz visit:
   https://github.com/hyperforge/ghidora/issues


`;
};
