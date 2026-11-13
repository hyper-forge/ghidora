import fs from "fs/promises";
import path from "node:path";
import * as tui from "../../pkg/ghidora_node.js";
import { BadgeKind } from "../datatypes/validateDataTypes.js";

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

async function mkdirp(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function writeIfMissing(file: string, content: string): Promise<void> {
  if (await exists(file)) {
    console.log(`↷ skipping ${path.basename(file)} (exists)`);
    return;
  }

  await fs.writeFile(file, content, "utf8");
  console.log(`✓ created ${file}`);
}

function installHint(pkg: string, cwdName: string): string {
  return `Install ${pkg} in ${cwdName} using your package manager (npm / pnpm / yarn / bun)`;
}

/* =========================
ROOT INIT
========================= */

export async function initRoot(root: string): Promise<void> {
  const pkgFile = path.join(root, "package.json");
  const cfgFile = path.join(root, "ghidora.config.mjs");

  const pkgExists = await exists(pkgFile);
  const cfgExists = await exists(cfgFile);

  if (pkgExists && cfgExists) {
    console.log("root already initialized");
    return;
  }

  if (!pkgExists) {
    const pkg = {
      name: "root",
      private: true,
      workspaces: ["packages/*", "apps/*"],
    };

    await fs.writeFile(pkgFile, JSON.stringify(pkg, null, 2));
    console.log("✓ created package.json");
  } else {
    console.log("↷ package.json exists");
  }

  const ghidoraCfg = tui.getGhidoraConfig();
  await writeIfMissing(cfgFile, ghidoraCfg);

  await mkdirp(path.join(root, "apps"));
  await mkdirp(path.join(root, "packages"));

  console.log(tui.badge("Workspace initialized", BadgeKind.Success));
}

/* =========================
APP INIT
========================= */

export async function initApp(root: string, name: string): Promise<void> {
  if (!name) {
    throw new Error("ghidora init --app <name>");
  }

  const dir = path.join(root, "apps", name);
  const src = path.join(dir, "src");

  await mkdirp(src);

  console.log(`\n[ghidora] creating app → ${name}\n`);

  const pkg = tui.getPackageTemplate("app", name);
  await writeIfMissing(path.join(dir, "package.json"), pkg);

  const esbuildCfg = tui.getEsbuildConfig();
  await writeIfMissing(path.join(dir, "esbuild.config.cjs"), esbuildCfg);

  await writeIfMissing(
    path.join(src, "main.ts"),
    `console.log("Hello from ${name}");\n`,
  );

  console.log(tui.badge(`app ${name} ready`, BadgeKind.Success));
  console.log(
    tui.badge(
      installHint("esbuild", name),
      BadgeKind.Info,
    ),
  );
}

/* =========================
LIB INIT
========================= */

export async function initLib(root: string, name: string): Promise<void> {
  if (!name) {
    throw new Error("ghidora init --lib <name>");
  }

  const dir = path.join(root, "packages", name);
  const src = path.join(dir, "src");

  await mkdirp(src);

  console.log(`\n[ghidora] creating lib → ${name}\n`);

  const pkg = tui.getPackageTemplate("lib", name);
  await writeIfMissing(path.join(dir, "package.json"), pkg);

  const tsconfig = tui.getTsconfig("lib");
  await writeIfMissing(path.join(dir, "tsconfig.json"), tsconfig);

  await writeIfMissing(
    path.join(src, "index.ts"),
    `export function hello() {
  return "hello from ${name}";
}\n`,
  );

  console.log(tui.badge(`lib ${name} ready`, BadgeKind.Success));
  console.log(
    tui.badge(
      installHint("typescript", name),
      BadgeKind.Info,
    ),
  );
}