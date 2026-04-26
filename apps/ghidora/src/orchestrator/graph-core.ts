// orchestrator/graph-core.ts

import { discoverWorkspace } from "./discover.js";
import { buildExecutionPlan } from "./graph.js";

export async function buildFullGraph(config: any) {
  const packages = await discoverWorkspace(config);

  return packages.map((pkg: any) => ({
    name: pkg.name,
    path: pkg.path,
    deps: pkg.deps ?? [],
    dependsOn: pkg.dependsOn ?? {},
    targets: pkg.targets ?? {}, // ✅ ADD THIS
    packageJson: pkg.packageJson ?? {}, // ✅ (optional but good)
  }));
}
