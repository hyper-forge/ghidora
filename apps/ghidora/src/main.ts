#!/usr/bin/env node
// cli.ts – FINAL production wiring (safe cross-platform version)
// Node orchestrates, packages decide, WASM enforces determinism

import process from "process";
import fs from "fs/promises";
import type { Dirent } from "fs";
import tui from "../pkg/ghidora.js";
import { buildExecutionPlan } from "./orchestrator/graph.js";
import { initRoot, initApp, initLib } from "./orchestrator/starters.js";
import { restoreFromCache, saveToCache } from "./orchestrator/cache.js";
import { serveGraph } from "./orchestrator/graph-server.js";
import { restoreFromCloud, saveToCloud } from "./orchestrator/cloud-cache.js";
import { ghidoraHelp } from "./utils/ghidoraHelp.js";
import {
  hashWorkspace,
  readGraphCache,
  writeGraphCache,
} from "./orchestrator/graph-cache.js";
import { buildFullGraph } from "./orchestrator/graph-core.js";
import ghidoraNpm from "../package.json" with { type: "json" };
export const currentVersion = ghidoraNpm.version;
import {
  argv,
  flags,
  loadConfig,
  parseCommandLine,
  parsePkgTask,
  rawArg,
  rawCmd,
  runTask,
  spawnUnified,
  handleProcessEvents,
  killProcess,
  getRunner,
  resolveUseShell,
  waitForExit,
  spawnShellCommand,
  spawnPackageRunner,
} from "./utils/helper.js";
import {
  type Executor,
  type PackageInfo,
  type TaskName,
} from "./datatypes/validateDataTypes.js";
import { checkForUpdates, getVersion } from "./updates/checkForUpdates.js";
import {
  dedupeTargets,
  executePlan,
  limitConcurrency,
} from "./orchestrator/executePlan.js";

// --scope parsing (supports: --scope a,b | --scope=a,b)
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a) continue;

  if (a === "--scope" && argv[i + 1] !== undefined) {
    flags.scopes = argv[i + 1]!.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    break;
  }

  if (a.startsWith("--scope=")) {
    flags.scopes = a
      .slice("--scope=".length)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    break;
  }
}

if (!rawCmd) {
  console.error(
    "Usage: ghidora <task> | ghidora run <pkg>:<task> | ghidora exec <cmd>",
  );
  process.exit(1);
}

const cmd = rawCmd;
const arg = rawArg;

/* =========================
UI BOOTSTRAP
========================= */
let cleaned = false;
process.stdout.write(tui.hide_cursor());

function restoreTTY() {
  if (cleaned) return;
  cleaned = true;
  process.stdout.write(tui.show_cursor());
}

process.on("exit", restoreTTY);

process.on("SIGINT", () => {
  restoreTTY();
  process.exit(0);
});

process.on("SIGTERM", () => {
  restoreTTY();
  process.exit(0);
});
/* =========================
MAIN ENTRY (ESM SAFE)
========================= */

async function main(): Promise<void> {
  /* ================================
  NODE-JS PROJECT TEMPLATES & ROOT
  =================================== */
  if (cmd === "init") {
    const isApp = argv.includes("--app");
    const isLib = argv.includes("--lib");

    let name: string | undefined;

    if (isApp) {
      name = argv[argv.indexOf("--app") + 1];
      if (!name) throw new Error("--app requires a package name");
    }

    if (isLib) {
      name = argv[argv.indexOf("--lib") + 1];
      if (!name) throw new Error("--lib requires a package name");
    }

    // process.stdout.write(tui.ghidora_logo());

    if (isApp) {
      await initApp(process.cwd(), name!);
    } else if (isLib) {
      await initLib(process.cwd(), name!);
    } else {
      process.stdout.write(tui.ghidora_logo());
      await initRoot(process.cwd());
    }

    return; // ✅ stop before config load
  }

  /* =========================
  HELP
  ========================= */

  if (cmd === "--help") {
    console.log(ghidoraHelp(currentVersion));
    return;
  }

  /* =========================
  CHECK FOR UPDATES AND VERSION
  ========================= */

  if (cmd === "--update") {
    checkForUpdates(currentVersion);
    return;
  }

  if (cmd === "--version" || cmd === "--v") {
    getVersion(ghidoraNpm.name, ghidoraNpm.version);
    return;
  }

  const config = await loadConfig(); /// MAIN
  const executor = (config.executor ?? "npm") as Executor; // MAIN - Executor
  const runner = getRunner(executor);

  /* =========================
GRAPH LOAD (CACHED)
========================= */

  let packages: PackageInfo[];

  const workspaceHash = await hashWorkspace(config);
  const cached = await readGraphCache();

  if (cached && cached.workspaceHash === workspaceHash) {
    packages = (cached.packages as PackageInfo[]).map((pkg) => ({
      ...pkg,
      deps: Array.isArray(pkg.deps) ? pkg.deps : [],
    }));

    process.stdout.write(tui.badge("Using cached graph", 0) + "\n");
  } else {
    process.stdout.write(tui.badge("Rebuilding graph...", 1) + "\n");

    const fresh = await buildFullGraph(config);

    const normalized = fresh.map((pkg: any) => ({
      ...pkg,
      deps: Array.isArray(pkg.deps) ? pkg.deps : [],
    }));

    await writeGraphCache({
      version: 1,
      workspaceHash,
      packages: normalized,
    });

    packages = normalized;
  }
  function scopedPackages(): PackageInfo[] {
    if (!flags.scopes) return packages;
    return packages.filter((p) => flags.scopes!.includes(p.name));
  }

  /* =========================
  GRAPH MODE
  ========================= */

  if (cmd === "graph") {
    serveGraph(scopedPackages(), config);
    return;
  }

  /* =========================
  GLOBAL CONCURRENCY (SINGLE KNOB)
  ========================= */

  const maxParallel =
    typeof config.totalParallelTasks === "number"
      ? Math.max(1, config.totalParallelTasks)
      : 1;

  const limit = limitConcurrency(maxParallel);
  let count = 0;
  if (cmd === "ls") {
    const roots = (config.packages ?? []).map((w) => w.replace(/\/\*$/, ""));

    for (const root of roots) {
      let entries: Dirent[] = [];
      try {
        entries = await fs.readdir(root, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const p = `${root}/${entry.name}`;
        try {
          await fs.access(`${p}/package.json`);
          console.log(tui.gradient(p));
          count++;
        } catch {
          // ignore
        }
      }
    }

    console.log(tui.badge(`Projects Found ${count}`, 1));
    return;
  }

  /* =========================
  STRICT MODE (DAG + CACHE)
  ========================= */

  async function runFinite(taskName: TaskName): Promise<void> {
    const plan = buildExecutionPlan(
      scopedPackages(),
      config,
      taskName,
    ) as Array<{ pkg: string; task: string }>;

    const taskDef = config.tasks?.[taskName];
    const outputs = taskDef?.outputs;

    await executePlan({
      targets: plan,
      parallel: maxParallel,
      noBail: flags.noBail,
      dryRun: flags.dryRun,

      runTarget: async ({ pkg: pkgName, task }) => {
        const pkg = packages.find((p) => p.name === pkgName);
        if (!pkg) throw new Error(`Unknown package ${pkgName}`);
        if (!pkg.targets?.[task]) return;

        const cloud = config.cloudCache;

        // 🔁 RESTORE
        if (!flags.noCache && outputs?.length) {
          let hit = false;

          if (cloud?.enabled) {
            hit = await restoreFromCloud(
              pkg,
              task,
              outputs,
              cloud,
              config as any,
            );

            if (hit) {
              process.stdout.write(
                tui.badge(
                  `Fetched From Cloud-Cache -> ${pkg.name}:${task}`,
                  1,
                ) + "\n",
              );
              return;
            }
          }

          hit = await restoreFromCache(pkg as any, task, config);

          if (hit) {
            process.stdout.write(
              tui.badge(`Restored From Local-Cache -> ${pkg.name}:${task}`, 1) +
                "\n",
            );
            return;
          }
        }

        // ▶ EXECUTE
        process.stdout.write(tui.header(`${pkg.name}:${task}`));
        await runTask(pkg, task, executor, config);

        // 💾 SAVE
        if (!flags.noCache && outputs?.length) {
          await saveToCache(pkg as any, task, config);

          if (cloud?.enabled) {
            await saveToCloud(pkg, task, outputs, cloud, config as any);
          }
        }
      },
    });
  }

  /* =========================
  PERSISTENT MODE
  ========================= */

  async function runPersistent(taskName: TaskName): Promise<void> {
    const children: ReturnType<typeof spawnUnified>[] = [];
    let shuttingDown = false;

    // 1. Unified Shutdown Logic
    function shutdown(code = 0): void {
      if (shuttingDown) return;
      shuttingDown = true;

      for (const c of children) {
        killProcess(c, "SIGINT");
      }
      process.exit(code);
    }

    const onSigint = () => shutdown(0);
    const onSigterm = () => shutdown(0);
    process.once("SIGINT", onSigint);
    process.once("SIGTERM", onSigterm);

    try {
      // 2. Map all packages to jobs to trigger the limit() manager simultaneously
      const jobs = scopedPackages().map(async (pkg) => {
        let pkgJson: { scripts?: Record<string, unknown> };

        try {
          pkgJson = JSON.parse(
            await fs.readFile(`${pkg.path}/package.json`, "utf8"),
          ) as { scripts?: Record<string, unknown> };
        } catch {
          return; // Skip if no package.json
        }

        if (!pkgJson.scripts?.[taskName]) return; // Skip if script missing

        return limit(
          () =>
            new Promise<void>((resolve, reject) => {
              const colorId = tui.pick_color(pkg.name);
              const prefix = `\x1b[${31 + colorId}m[${pkg.name}]\x1b[0m `;
              const child = spawnPackageRunner(
                executor,
                taskName,
                {
                  cwd: pkg.path,
                  stdio: ["inherit", "pipe", "pipe"],
                },
                config,
              );

              children.push(child);

              handleProcessEvents(child, {
                onStdout: (d) => process.stdout.write(prefix + d.toString()),
                onStderr: (d) => process.stderr.write(prefix + d.toString()),
                onError: reject,
                // onExit: (code) => {
                //   if ((code ?? 1) !== 0 && !flags.noBail) {
                //     shutdown(1);
                //   }
                //   resolve();
                // }, //04182026
                onExit: (code) => {
                  const idx = children.indexOf(child);
                  if (idx !== -1) children.splice(idx, 1);

                  if ((code ?? 1) !== 0 && !flags.noBail) {
                    shutdown(1);
                    return;
                  }

                  // ✅ graceful completion
                  if (children.length === 0 && !shuttingDown) {
                    shutdown(0);
                  }

                  resolve();
                },
              });
            }),
        );
      });

      // 4. Wait for all spawns to initiate
      await Promise.all(jobs);

      // Keep the main process alive while children are running
      await new Promise<void>((resolve) => {
        process.once("SIGINT", resolve);
        process.once("SIGTERM", resolve);
      });
    } finally {
      process.off("SIGINT", onSigint);
      process.off("SIGTERM", onSigterm);
    }
  }

  /* =========================
  LOOSE MODE
  ========================= */

  async function runLoose(taskName: TaskName): Promise<void> {
    await executePlan({
      targets: scopedPackages(),
      parallel: maxParallel,
      noBail: flags.noBail,
      runTarget: (pkg) => runTask(pkg, taskName, executor, config),
    });
  }

  /* =========================
  EXEC MODE
  ========================= */

  // async function runExec(command: string): Promise<void> {
  //   const { command: cmdName, args } = parseCommandLine(command);

  //   await executePlan({
  //     targets: scopedPackages(),
  //     parallel: maxParallel,
  //     noBail: flags.noBail,
  //     runTarget: (pkg) =>
  //       new Promise<void>((resolve, reject) => {
  //         const child = spawnUnified(
  //           cmdName,
  //           args,
  //           {
  //             cwd: pkg.path,
  //             stdio: ["ignore", "pipe", "pipe"],
  //           },
  //           config,
  //         );

  //         handleProcessEvents(child, {
  //           onStdout: (d) =>
  //             process.stdout.write(
  //               `${tui.badge(pkg.name, (tui as any).BadgeKind?.Success ?? 0)} - ${d.toString()}`,
  //             ),
  //           onStderr: (d) =>
  //             process.stderr.write(`[${pkg.name}] ${d.toString()}`),
  //           onError: reject,
  //           onExit: (code) => {
  //             if ((code ?? 1) === 0 || flags.noBail) resolve();
  //             else reject(new Error(`${pkg.name}: exec failed (${code})`));
  //           },
  //         });
  //       }),
  //   });
  // }

  // runTask-like manual spawn sites

  // runExec
  async function runExec(commandLine: string): Promise<void> {
    const useShell = resolveUseShell(commandLine, [], config?.shell ?? "auto");

    const parsed = !useShell ? parseCommandLine(commandLine) : null;

    await executePlan({
      targets: scopedPackages(),
      parallel: useShell ? 1 : maxParallel,
      noBail: flags.noBail,

      runTarget: (pkg) =>
        new Promise<void>((resolve, reject) => {
          if (useShell) {
            console.log(
              `${tui.badge(pkg.name, tui.BadgeKind?.Info ?? 1)} → ${commandLine}`,
            );
          }

          const child = useShell
            ? spawnShellCommand(
                commandLine,
                { cwd: pkg.path, stdio: "inherit" }, 
                config?.sandbox,
                config,
              )
            : spawnUnified(
                parsed!.command,
                parsed!.args,
                { cwd: pkg.path, stdio: ["ignore", "pipe", "pipe"] },
                config,
              );

          handleProcessEvents(child, {
            onError: reject,
            onExit: (code) => {
              if ((code ?? 1) === 0 || flags.noBail) resolve();
              else reject(new Error(`${pkg.name}: exec failed (${code})`));
            },
            onStdout: useShell
              ? undefined
              : (d) =>
                  process.stdout.write(
                    `${tui.badge(pkg.name, tui.BadgeKind?.Success ?? 0)} - ${d}`,
                  ),
            onStderr: useShell
              ? undefined
              : (d) => process.stderr.write(`[${pkg.name}] ${d}`),
          });
        }),
    });
  }
  /* =========================
  RUN PARALLEL TASKS TOGETHER
  ========================= */

  async function runMany(targets: string[]): Promise<void> {
    const uniqueTargets = dedupeTargets(targets);
    await executePlan({
      targets: uniqueTargets,
      parallel: maxParallel,
      noBail: flags.noBail,
      runTarget: async (target) => {
        const { pkgName, task } = parsePkgTask(target);

        const pkg = packages.find((p) => p.name === pkgName);
        if (!pkg) throw new Error(`Unknown package ${pkgName}`);

        const colorId = tui.pick_color(pkg.name);
        const prefix = `\x1b[${31 + colorId}m[${pkg.name}]\x1b[0m `;

        const child = spawnPackageRunner(
          executor,
          task,
          {
            cwd: pkg.path,
            stdio: ["inherit", "pipe", "pipe"],
          },
          config,
        );

        handleProcessEvents(child, {
          onStdout: (d) => process.stdout.write(prefix + d.toString()),
          onStderr: (d) => process.stderr.write(prefix + d.toString()),
        });

        // ⚠️ same as before: do NOT await exit
        return;
      },
    });
  }

  // X2 with deps

  async function runManyWithDeps(targets: string[]): Promise<void> {
    const uniqueTargets = dedupeTargets(targets);

    // ✅ GLOBAL across all targets
    const globalVisited = new Set<string>();

    await executePlan({
      targets: uniqueTargets,
      parallel: maxParallel,
      noBail: flags.noBail,

      runTarget: async (target) => {
        const { pkgName, task } = parsePkgTask(target);
        const pkg = packages.find((p) => p.name === pkgName);
        if (!pkg) throw new Error(`Unknown package ${pkgName}`);

        async function runWithDeps(p: PackageInfo, t: string): Promise<void> {
          const key = `${p.name}:${t}`;

          // 🔥 THIS is the key change
          if (globalVisited.has(key)) return;
          globalVisited.add(key);

          for (const dep of p.dependsOn?.[t] ?? []) {
            const { pkgName: depPkgName, task: depTask } = parsePkgTask(dep);
            const depPkg = packages.find((x) => x.name === depPkgName);
            if (!depPkg) throw new Error(`Unknown dependency ${depPkgName}`);
            await runWithDeps(depPkg, depTask);
          }

          const colorId = tui.pick_color(p.name);
          const prefix = `\x1b[${31 + colorId}m[${p.name}]\x1b[0m `;

          const child = spawnPackageRunner(
            executor,
            t,
            {
              cwd: p.path,
              stdio: ["inherit", "pipe", "pipe"],
            },
            config,
          );

          handleProcessEvents(child, {
            onStdout: (d) => process.stdout.write(prefix + d.toString()),
            onStderr: (d) => process.stderr.write(prefix + d.toString()),
          });

          return;
        }

        await runWithDeps(pkg, task);
      },
    });
  }

  /* =========================
  COMMAND DISPATCH
  ========================= */

  try {
    if (cmd === "exec") {
      await runExec(arg ?? "");
    } else if (cmd === "run") {
      const { pkgName, task } = parsePkgTask(String(arg ?? ""));
      if (!pkgName || !task) {
        throw new Error('run requires "<pkg>:<task>"');
      }

      const pkg = packages.find((p) => p.name === pkgName);
      if (!pkg) throw new Error(`Unknown package ${pkgName}`);

      const visited = new Set<string>();

      async function runWithDeps(p: PackageInfo, t: string): Promise<void> {
        const key = `${p.name}:${t}`;
        if (visited.has(key)) return;
        visited.add(key);

        const deps = p.dependsOn?.[t] ?? [];

        for (const dep of deps) {
          const { pkgName: depPkgName, task: depTask } = parsePkgTask(dep);

          const depPkg = packages.find((x) => x.name === depPkgName);
          if (!depPkg) {
            throw new Error(`Unknown dependency ${depPkgName}`);
          }
          await runWithDeps(depPkg, depTask);
        }

        await limit(() => runTask(p, t, executor, config));
      }

      await runWithDeps(pkg, task);
    } else if (cmd === "run-many") {
      await runMany(argv.slice(1));
    } else if (cmd === "run-many-deps") {
      await runManyWithDeps(argv.slice(1));
    } else {
      const taskDef = config.tasks?.[cmd];
      if (taskDef) {
        taskDef.persistent ? await runPersistent(cmd) : await runFinite(cmd);
      } else {
        await runLoose(cmd);
      }
    }

    process.stdout.write(tui.badge("DONE", 2));
  } catch (err: unknown) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

/* =========================
BOOT
========================= */

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
