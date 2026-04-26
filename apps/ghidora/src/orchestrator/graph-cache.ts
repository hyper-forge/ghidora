// orchestrator/graph-cache.ts

import fs from "fs/promises";
import path from "path";
import tui from "../../pkg/ghidora.js"; // adjust path if needed

type GraphCache = {
  version: 1;
  workspaceHash: string;
  packages: any[];
};

const CACHE_FILE = ".ghidora/graph.json";

/* =========================
WASM HASH (BYTE-BASED)
========================= */

function hashBytes(input: Uint8Array): string {
  return Buffer.from(tui.hash_bytes(input)).toString("hex");
}

/* =========================
WORKSPACE HASH (FAST)
========================= */

export async function hashWorkspace(config: any): Promise<string> {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];

  // include config
  chunks.push(encoder.encode(JSON.stringify(config)));

  for (const pattern of config.packages ?? []) {
    const root = pattern.replace(/\/\*$/, "");

    let dirs: string[] = [];
    try {
      dirs = await fs.readdir(root);
    } catch {
      continue;
    }

    for (const d of dirs) {
      const pkgPath = path.join(root, d, "package.json");

      try {
        const stat = await fs.stat(pkgPath);

        // only metadata → FAST
        chunks.push(
          encoder.encode(pkgPath + ":" + stat.mtimeMs)
        );
      } catch {
        // ignore missing package.json
      }
    }
  }

  // merge all chunks into one buffer
  const totalSize = chunks.reduce((acc, c) => acc + c.length, 0);
  const merged = new Uint8Array(totalSize);

  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }

  return hashBytes(merged);
}

/* =========================
CACHE READ
========================= */

export async function readGraphCache(): Promise<GraphCache | null> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* =========================
CACHE WRITE
========================= */

export async function writeGraphCache(data: GraphCache) {
  await fs.mkdir(".ghidora", { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(data), "utf8");
}