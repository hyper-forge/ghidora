import fs from "fs/promises";
import type { Dirent } from "fs";
import path from "path";
import type { PackageJson, WorkspaceConfig, DiscoverWorkspaceNode } from "../datatypes/validateDataTypes";

async function expandGlob(root: string, pattern: string): Promise<string[]> {
  const parts = pattern.split("/");

  // only support single * segment (intentional)
  const starIndex = parts.indexOf("*");
  if (starIndex === -1) {
    return [path.join(root, pattern)];
  }

  const base = path.join(root, ...parts.slice(0, starIndex));

  let entries: Dirent[];
  try {
    entries = await fs.readdir(base, { withFileTypes: true });
  } catch {
    return [];
  }

  const results: string[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;

    const full = path.join(base, e.name, ...parts.slice(starIndex + 1));
    results.push(full);
  }

  return results;
}

/**
 * Read package.json safely
 */
async function readPackageJson(dir: string): Promise<PackageJson | null> {
  const file = path.join(dir, "package.json");

  try {
    const buf = await fs.readFile(file, "utf8");
    return JSON.parse(buf) as PackageJson;
  } catch {
    return null;
  }
}

/**
 * Discover all workspace packages
 */
export async function discoverWorkspace(
  config: WorkspaceConfig,
): Promise<DiscoverWorkspaceNode[]> {
  const root = config.workspaceRoot;
  const patterns = config.packages ?? [];

  /* ---------- collect dirs ---------- */

  const dirSet = new Set<string>();

  for (const p of patterns) {
    const expanded = await expandGlob(root, p);
    for (const dir of expanded) {
      dirSet.add(dir);
    }
  }

  const dirs = Array.from(dirSet);

  /* ---------- read package.json in parallel ---------- */

  const results = await Promise.all(
    dirs.map(async (dir) => {
      const pkg = await readPackageJson(dir);
      if (!pkg?.name) return null;
      return { name: pkg.name, dir, pkg };
    }),
  );

  const nameToPath = new Map<string, string>();
  const packageData = new Map<string, PackageJson>();

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (!r) continue;

    nameToPath.set(r.name, r.dir);
    packageData.set(r.name, r.pkg);
  }

  /* ---------- resolve deps ---------- */

  const nodes: DiscoverWorkspaceNode[] = [];

  for (const [name, dir] of nameToPath) {
    const pkg = packageData.get(name)!;

    const localDepsSet = new Set<string>();

    const sources = [
      pkg.dependencies,
      pkg.devDependencies,
      pkg.peerDependencies,
    ];

    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      if (!src) continue;

      for (const depName in src) {
        if (nameToPath.has(depName)) {
          localDepsSet.add(depName);
        }
      }
    }

    nodes.push({
      name,
      path: dir,
      deps: localDepsSet.size ? Array.from(localDepsSet) : [],
      targets: pkg.scripts ?? {},
      dependsOn: pkg.ghidoraconfig?.dependsOn ?? {},
      packageJson: pkg,
    });
  }

  return nodes;
}
