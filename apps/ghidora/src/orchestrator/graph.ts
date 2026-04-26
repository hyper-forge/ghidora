// orchestrator/graph.ts

import type {
  OrchestratorConfig,
  PackageInfo,
  TaskDef,
  WorkspaceNode,
} from "../datatypes/validateDataTypes";

/**
 * Build a map for quick lookup
 */
function indexPackages(packages: (PackageInfo | WorkspaceNode)[]) {
  const map = new Map<string, PackageInfo | WorkspaceNode>();
  for (const p of packages) map.set(p.name, p);
  return map;
}

/**
 * Expand a single task reference into its dependency graph
 */
function expandTask(
  pkgName: string,
  taskName: string,
  config: OrchestratorConfig,
  pkgIndex: Map<string, PackageInfo | WorkspaceNode>,
  seen: Set<string>,
  out: TaskDef[],
): void {
  const key = `${pkgName}:${taskName}`;
  if (seen.has(key)) return;
  seen.add(key);

  const taskCfg = config.tasks?.[taskName];
  if (!taskCfg) {
    throw new Error(`Unknown task '${taskName}'`);
  }

  // handle dependsOn
  for (const dep of taskCfg.dependsOn ?? []) {
    if (dep.startsWith("^")) {
      // dependency packages first
      const depTask = dep.slice(1);
      const pkg = pkgIndex.get(pkgName);
      if (!pkg) continue;

      for (const d of pkg.deps) {
        expandTask(d, depTask, config, pkgIndex, seen, out);
      }
    } else {
      expandTask(pkgName, dep, config, pkgIndex, seen, out);
    }
  }

  out.push({ pkg: pkgName, task: taskName });
}

/**
 * Topological sort using DFS ordering
 */
export function buildExecutionPlan(
  packages: (PackageInfo | WorkspaceNode)[],
  config: OrchestratorConfig,
  taskName: string,
): TaskDef[] {
  const pkgIndex = indexPackages(packages);
  const seen = new Set<string>();
  const plan: TaskDef[] = [];

  for (const pkg of packages) {
    expandTask(pkg.name, taskName, config, pkgIndex, seen, plan);
  }

  return plan;
}
