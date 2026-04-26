import http from "node:http";
import process from "node:process";
import { spawn } from "node:child_process";

import tui from "../../pkg/ghidora.js";

/* =========================
TYPES
========================= */

type WorkspaceNode = {
  name: string;
  deps: string[];
  packageJson?: any;
  description?: string;
  version?: string;
  private?: boolean;
  homepage?: string;
  repository?: any;
  kind?: "package" | "app";
};

type TaskNode = {
  id: string;
  pkg: string;
  task: string;
  depends_on: string[];
};

type OrchestratorConfig = {
  tasks?: Record<string, { dependsOn?: string[] }>;
};

type PackageCard = {
  name: string;
  deps: string[];
  description: string;
  version: string;
  private: boolean;
  kind: string;
  homepage: string;
  repository: string;
  tasks: number;
};

type GraphPayload = {
  nodes: TaskNode[];
  packages: PackageCard[];
  initial_selected_id: string;
};

/* =========================
MAIN SERVER (CORRECT MODEL)
========================= */

export function serveGraph(
  packages: WorkspaceNode[],
  config: OrchestratorConfig,
) {
  const planMap = new Map<string, TaskNode>();

  // ✅ STEP 1: create nodes ONLY from actual scripts
  for (const pkg of packages) {
    const scripts = pkg.packageJson?.scripts;

    if (!scripts) continue;

    for (const task of Object.keys(scripts)) {
      const id = `${pkg.name}:${task}`;

      planMap.set(id, {
        id,
        pkg: pkg.name,
        task,
        depends_on: [],
      });
    }
  }

  const idSet = new Set(planMap.keys());

  /* =========================
  STEP 2: resolve dependencies (ONLY between existing nodes)
  ========================= */

  for (const node of planMap.values()) {
    const taskCfg = config.tasks?.[node.task];
    if (!taskCfg) continue;

    for (const dep of taskCfg.dependsOn ?? []) {
      if (dep.startsWith("^")) {
        const depTask = dep.slice(1);
        const pkgObj = packages.find((p) => p.name === node.pkg);

        for (const d of pkgObj?.deps || []) {
          const depId = `${d}:${depTask}`;
          if (idSet.has(depId)) {
            node.depends_on.push(depId);
          }
        }
      } else {
        const depId = `${node.pkg}:${dep}`;
        if (idSet.has(depId)) {
          node.depends_on.push(depId);
        }
      }
    }
  }

  const taskPlan = [...planMap.values()];
  const packageCards = collectPackageCards(packages, taskPlan);

  const payload: GraphPayload = {
    nodes: taskPlan,
    packages: packageCards,
    initial_selected_id: taskPlan[0]?.id ?? "",
  };

  const html = tui.generate_graphui(payload);

  const server = http.createServer((_, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });

  server.listen(0, () => {
    const addr = server.address();
    if (!addr || typeof addr === "string") return;

    const url = `http://localhost:${addr.port}`;
    console.log(`GHIDORA graph → ${url}`);
    openBrowser(url);
  });
}

/* =========================
HELPERS
========================= */

function collectPackageCards(
  packages: WorkspaceNode[],
  nodes: TaskNode[],
): PackageCard[] {
  const taskCountByPkg = new Map<string, number>();

  for (const n of nodes) {
    taskCountByPkg.set(n.pkg, (taskCountByPkg.get(n.pkg) ?? 0) + 1);
  }

  return packages.map((p) => {
    const pkgJson = p.packageJson ?? {};

    return {
      name: p.name,
      deps: p.deps ?? [],
      description: p.description ?? pkgJson.description ?? "No description",
      version: p.version ?? pkgJson.version ?? "",
      private: Boolean(p.private ?? pkgJson.private),
      kind: p.kind ?? "package",
      homepage: p.homepage ?? pkgJson.homepage ?? "",
      repository: normalizeRepo(p.repository ?? pkgJson.repository),
      tasks: taskCountByPkg.get(p.name) ?? 0,
    };
  });
}

function normalizeRepo(repo: any): string {
  if (!repo) return "";
  if (typeof repo === "string") return repo;
  return repo.url ?? "";
}

export function openBrowser(url: string) {
  const platform = process.platform;

  let cmd: string;
  let args: string[];

  if (platform === "win32") {
    cmd = "cmd.exe";
    args = ["/c", "start", "", url];
  } else if (platform === "darwin") {
    cmd = "open";
    args = [url];
  } else {
    const candidates = ["xdg-open", "gio", "gnome-open"];

    for (const c of candidates) {
      try {
        const child = spawn(c, [url], {
          stdio: "ignore",
          detached: true,
        });

        let handled = false;

        child.on("error", () => {
          handled = true;
        });

        child.on("spawn", () => {
          handled = true;
        });

        child.unref();

        // if command exists, assume success
        if (handled) return;
      } catch {
        // ignore and try next
      }
    }

    console.log(`⚠ Unable to open browser. Visit: ${url}`);
    return;
  }

  try {
    const child = spawn(cmd, args, {
      stdio: "ignore",
      detached: true,
    });

    child.on("error", () => {
      console.log(`⚠ Unable to open browser. Visit: ${url}`);
    });

    child.unref();
  } catch {
    console.log(`⚠ Unable to open browser. Visit: ${url}`);
  }
}
