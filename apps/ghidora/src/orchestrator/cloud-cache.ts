import fs from "fs/promises";
import path from "path";
import tui from "../../pkg/ghidora.js";
import type {
  PackageInfo,
  CloudTaskConfig,
  CloudTaskDef,
  CloudConfig,
} from "../datatypes/validateDataTypes.js";

/* =========================
   HASH HELPERS
========================= */

async function hashFile(p: string): Promise<Uint8Array> {
  try {
    const buf = await fs.readFile(p);
    return tui.hash_bytes(buf);
  } catch {
    return new Uint8Array();
  }
}

async function hashPath(p: string): Promise<Uint8Array> {
  try {
    const stat = await fs.stat(p);

    if (stat.isFile()) {
      return await hashFile(p);
    }

    if (stat.isDirectory()) {
      const entries = await fs.readdir(p, { withFileTypes: true });

      // deterministic order
      entries.sort((a, b) => a.name.localeCompare(b.name));

      const chunks: Uint8Array[] = [];

      for (const e of entries) {
        // ignore heavy dirs
        if (e.name === "node_modules" || e.name === ".git") continue;

        const full = path.join(p, e.name);
        const childHash = await hashPath(full);

        // skip empty hashes (missing files, ignored paths, etc.)
        if (childHash && childHash.length > 0) {
          chunks.push(childHash);
        }
      }

      // avoid ambiguous empty concat
      const combined =
        chunks.length > 0 ? Buffer.concat(chunks) : Buffer.alloc(0);

      return tui.hash_bytes(combined);
    }

    return new Uint8Array();
  } catch (err: unknown) {
    // optional debug (keep silent by default)
    // console.debug("hashPath skipped:", p);

    return new Uint8Array();
  }
}

/* =========================
   CACHE KEY (FIXED 🔥)
========================= */

export async function computeCacheKey(
  pkg: PackageInfo,
  task: string,
  config: CloudTaskConfig,
): Promise<string> {
  const taskDef = config.tasks?.[task];
  const inputs = taskDef?.inputs ?? [];

  const chunks: Uint8Array[] = [];

  for (const input of inputs) {
    try {
      const abs = path.join(pkg.path, input);
      const hash = await hashPath(abs);

      // skip empty hashes (non-existent paths etc.)
      if (hash && hash.length > 0) {
        chunks.push(hash);
      }
    } catch {
      // ignore individual input failures (consistent with your design)
    }
  }

  // handle empty inputs safely
  const combined = chunks.length > 0 ? Buffer.concat(chunks) : Buffer.alloc(0);

  const finalHash = tui.hash_bytes(combined);

  return `${pkg.name}:${task}:${Buffer.from(finalHash).toString("hex")}`;
}

/* =========================
   FETCH (robust)
========================= */

async function fetchCache(
  key: string,
  cloud: CloudConfig,
): Promise<Uint8Array | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${cloud.url}/cache/${encodeURIComponent(key)}`, {
      headers: cloud.token ? { authorization: `Bearer ${cloud.token}` } : {},
      signal: controller.signal,
    });

    if (res.status === 404) return null;

    if (!res.ok) {
      console.error(`☁️ fetch failed [${res.status}] ${key}`);
      return null;
    }

    const buffer = await res.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`☁️ fetch timeout: ${key}`);
    } else if (err instanceof Error) {
      console.error("☁️ fetch error:", err.message);
    } else {
      console.error("☁️ fetch error:", err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function storeCache(
  key: string,
  body: Uint8Array,
  cloud: CloudConfig,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${cloud.url}/cache/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: {
        "content-type": "application/octet-stream",
        ...(cloud.token ? { authorization: `Bearer ${cloud.token}` } : {}),
      },
      body: Buffer.from(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(`☁️ store failed [${res.status}] ${key}`);
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`☁️ store timeout: ${key}`);
    } else if (err instanceof Error) {
      console.error("☁️ store error:", err.message);
    } else {
      console.error("☁️ store error:", err);
    }
  } finally {
    clearTimeout(timeout);
  }
}
/* =========================
   FILE COLLECTION
========================= */

async function collectOutputs(
  pkg: PackageInfo,
  outputs: string[],
): Promise<Record<string, Uint8Array>> {
  const files: Record<string, Uint8Array> = {};

  for (const out of outputs) {
    const abs = path.join(pkg.path, out);

    try {
      const stat = await fs.stat(abs);

      if (stat.isFile()) {
        files[out] = await fs.readFile(abs);
      } else if (stat.isDirectory()) {
        const walk = async (dir: string, base: string): Promise<void> => {
          const entries = await fs.readdir(dir, { withFileTypes: true });

          for (const e of entries) {
            const full = path.join(dir, e.name);
            const rel = path.join(base, e.name);

            if (e.isDirectory()) {
              await walk(full, rel);
            } else if (e.isFile()) {
              // only safety: avoid overwrite
              if (!(rel in files)) {
                files[rel.replace(/\\/g, "/")] = await fs.readFile(full);
              }
            }
          }
        };

        await walk(abs, out);
      }
    } catch {
      // expected: missing outputs → ignore
    }
  }

  return files;
}

/* =========================
   PUBLIC API
========================= */

export async function restoreFromCloud(
  pkg: PackageInfo,
  task: string,
  outputs: string[],
  cloud: CloudConfig | undefined,
  config: CloudTaskConfig,
): Promise<boolean> {
  if (!cloud?.enabled || !cloud.url) return false;

  const key = await computeCacheKey(pkg, task, config);
  const data = await fetchCache(key, cloud);

  if (!data) {
    console.log(`☁️ no cloud cache for ${key}`);
    return false;
  }

  // console.log(`☁️ fetched cache bytes for ${key}: ${data.length}`);
  // console.log(`☁️ first 8 bytes for ${key}:`, Array.from(data.slice(0, 8)));

  try {
    // console.log(`☁️ untargz start: ${key}`);
    const files = tui.untargz_files(data) as Record<string, Uint8Array>;
    const fileCount = files ? Object.keys(files).length : 0;
    // console.log(`☁️ untargz done: ${key}, files=${fileCount}`);

    // guard: empty or invalid archive
    if (!files) {
      console.error(`☁️ unpack failed: ${key}`);
      return false;
    }

    for (const [rel, content] of Object.entries(files)) {
      const outPath = path.join(pkg.path, rel);

      console.log(`☁️ restore file: ${rel}, bytes=${content.length}`);

      // ensure directory exists
      await fs.mkdir(path.dirname(outPath), { recursive: true });

      // write file
      await fs.writeFile(outPath, Buffer.from(content));
    }

    return true;
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("☁️ unpack error:", err.message);
    } else {
      console.error("☁️ unpack error:", err);
    }
    return false;
  }
}

export async function saveToCloud(
  pkg: PackageInfo,
  task: string,
  outputs: string[],
  cloud: CloudConfig | undefined,
  config: CloudTaskConfig,
): Promise<void> {
  if (!cloud?.enabled || !cloud.url) {
    console.log("☁️ cloud disabled");
    return;
  }

  const key = await computeCacheKey(pkg, task, config);
  const files = await collectOutputs(pkg, outputs);

  const fileEntries = Object.entries(files);
  const fileCount = fileEntries.length;

  console.log(`☁️ collected ${fileCount} files for ${pkg.name}:${task}`);

  if (fileCount === 0) {
    console.log(`☁️ no outputs to upload for ${key}`);
    return;
  }

  console.log(`☁️ uploading ${key} (${fileCount} files)`);

  // 🔥 ADD THIS BLOCK (important)
  for (const [k, v] of fileEntries) {
    if (!k || typeof k !== "string") {
      console.error("❌ invalid key:", k);
      return;
    }
    if (!(v instanceof Uint8Array)) {
      console.error("❌ invalid value for:", k);
      return;
    }
  }

  try {
    const buf = tui.targz_files({ files });

    if (!buf || buf.length === 0) {
      console.error(`☁️ pack failed (empty buffer): ${key}`);
      return;
    }

    await storeCache(key, buf, cloud);
  } catch (err: unknown) {
    console.error("☁️ pack/store error:", err);

    // 🔥 ADD THIS DEBUG (find exact culprit)
    // console.log("DEBUG keys:", fileEntries.map(([k]) => k).slice(0, 10));
  }
}
