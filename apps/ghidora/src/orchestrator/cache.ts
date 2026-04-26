// orchestrator/cache.ts
// Deterministic cache layer (Node policy, WASM enforcement)

import fs from "fs/promises";
import path from "path";
import tui from "../../pkg/ghidora.js";
import type { OrchestratorConfig, WorkspaceNode } from "../datatypes/validateDataTypes.js";


/* =========================
UTILS
========================= */

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Recursively walk a directory and return file paths (relative)
 */
async function walkDir(root: string, sub = ""): Promise<string[]> {
  const abs = path.join(root, sub);
  const entries = await fs.readdir(abs, { withFileTypes: true });

  const files: string[] = [];
  for (const e of entries) {
    const rel = path.join(sub, e.name);

    if (e.isDirectory()) {
      files.push(...(await walkDir(root, rel)));
    } else if (e.isFile()) {
      files.push(rel);
    }
  }
  return files;
}

/**
 * Expand output patterns:
 *  - file
 *  - directory
 *  - dir/**
 */
async function expandOutputs(
  pkgPath: string,
  pattern: string
): Promise<string[]> {
  const base = pattern.replace(/\/\*\*$/, "");
  const abs = path.join(pkgPath, base);

  if (!(await exists(abs))) return [];

  const stat = await fs.stat(abs);

  if (stat.isFile()) {
    return [base];
  }

  if (stat.isDirectory()) {
    const files = await walkDir(abs);
    return files.map((f) => path.join(base, f));
  }

  return [];
}

/* =========================
INPUT HASH
========================= */

async function collectInputs(
  pkg: WorkspaceNode,
  taskName: string,
  config: OrchestratorConfig
): Promise<Buffer> {
  const bufs: Buffer[] = [];

  const taskCfg = config.tasks?.[taskName] ?? {};
  const inputs = taskCfg.inputs ?? [];

  // task config itself
  bufs.push(Buffer.from(JSON.stringify(taskCfg)));

  // declared inputs (SOURCE FILES)
  const inputFiles = await collectInputFiles(pkg.path, inputs);
  bufs.push(...inputFiles);

  return Buffer.concat(bufs);
}

function cachePath(
  config: OrchestratorConfig,
  pkgName: string,
  taskName: string,
  hashHex: string
): string {
  return path.join(
    config.cacheDir,
    pkgName,
    taskName,
    `${hashHex}.tar.gz`
  );
}

/* =========================
RESTORE
========================= */

export async function restoreFromCache(
  pkg: WorkspaceNode,
  taskName: string,
  config: OrchestratorConfig
): Promise<boolean> {
  const inputBytes = await collectInputs(pkg, taskName, config);

  const hashHex = Buffer.from(
    tui.hash_bytes(inputBytes)
  ).toString("hex");

  const artifact = cachePath(config, pkg.name, taskName, hashHex);
  if (!(await exists(artifact))) return false;

  const buf = await fs.readFile(artifact);

  // MUST match targz_files
  const files = tui.untargz_files(buf) as Record<string, Uint8Array>;

  for (const [rel, data] of Object.entries(files)) {
    const outPath = path.join(pkg.path, rel);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, Buffer.from(data));
  }

  return true;
}

export async function collectInputFiles(
  pkgPath: string,
  patterns: string[]
): Promise<Buffer[]> {
  const files: Buffer[] = [];

  for (const p of patterns) {
    const expanded = await expandOutputs(pkgPath, p);

    for (const rel of expanded) {
      const abs = path.join(pkgPath, rel);
      files.push(await fs.readFile(abs));
    }
  }

  return files;
}

/* =========================
SAVE
========================= */

export async function saveToCache(
  pkg: WorkspaceNode,
  taskName: string,
  config: OrchestratorConfig
): Promise<void> {
  const taskCfg = config.tasks?.[taskName];
  const outputs = taskCfg?.outputs;

  // No declared outputs → never cache
  if (!outputs || outputs.length === 0) return;

  const files: Record<string, Buffer> = {};

  for (const pattern of outputs) {
    const relFiles = await expandOutputs(pkg.path, pattern);

    for (const rel of relFiles) {
      const abs = path.join(pkg.path, rel);

      // 🔑 CRITICAL: normalize path for TAR (POSIX only)
      const tarPath = rel.replace(/\\/g, "/");

      files[tarPath] = await fs.readFile(abs);
    }
  }

  // 🔒 HARD RULE: never write empty cache
  if (Object.keys(files).length === 0) return;

  const inputBytes = await collectInputs(pkg, taskName, config);

  const hashHex = Buffer.from(
    tui.hash_bytes(inputBytes)
  ).toString("hex");

  const buf = tui.targz_files({ files });
  const artifact = cachePath(config, pkg.name, taskName, hashHex);

  await fs.mkdir(path.dirname(artifact), { recursive: true });
  await fs.writeFile(artifact, Buffer.from(buf));
}