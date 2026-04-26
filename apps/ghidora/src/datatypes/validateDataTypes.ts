/* =========================
   TYPES MAIN
========================= */

type TaskName = string;
type PackageName = string;
type Executor = "npm" | "pnpm" | "yarn" | "bun" | "deno";

interface PackageInfo {
  targets: Record<string, string>;
  packageJson: PackageJson;
  name: PackageName;
  path: string;
  deps: string[];
  dependsOn?: Record<string, string[]>;
}

interface TaskDef {
  persistent?: boolean;
  outputs?: string[];
  dependsOn?: string[];
  pkg: string;
  task: string;
}

interface Config {
  workspaceRoot: string;
  packages?: string[];
  totalParallelTasks?: number;
  cacheDir: string;
  tasks?: Record<string, TaskDef>;
  cloudCache?: {
    enabled: boolean;
    url: string;
    token?: string;
  };
  executor?: Executor;
  enableSandbox?: boolean;
  sandbox?: SandboxConfig;
  shell?: boolean | "auto";
}

interface Flags {
  noCache: boolean;
  dryRun: boolean;
  noBail: boolean;
  affected: boolean;
  scopes: string[] | null;
}

interface ParsedCommand {
  command: string;
  args: string[];
}

/* =========================
TYPES WORKSPACE
========================= */

export interface TaskConfig {
  inputs?: string[];
  outputs?: string[];
  dependsOn?: string[];
}

export interface OrchestratorConfig {
  cacheDir: string;
  tasks?: Record<string, TaskConfig>;
}

/* =========================
   TYPES CLOUD
========================= */

export interface CloudConfig {
  enabled: boolean;
  url: string;
  token?: string;
}

export interface CloudTaskDef {
  inputs?: string[];
}

export interface CloudTaskConfig {
  tasks?: Record<string, CloudTaskDef>;
}

/**
 * Discover Types
 */

export interface DiscoverWorkspaceNode {
  name: string;
  path: string;
  deps: string[];
  targets: Record<string, string>;
  dependsOn: Record<string, unknown>;
  packageJson: PackageJson;
}

export interface WorkspaceConfig {
  workspaceRoot: string;
  packages?: string[];
}

export interface WorkspaceNode {
  name: string;
  path: string;
  deps: string[];
  targets: Record<string, string>;
  dependsOn: Record<string, unknown>;
  packageJson: PackageJson;
}

export interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  ghidoraconfig?: {
    dependsOn?: Record<string, unknown>;
  };
}

type NodeSandbox = {
  cwd?: string;
  env?: Record<string, string>;
  clearEnv?: boolean;
  uid?: number;
  gid?: number;
};

// DENO-SANDBOX

type SandboxConfig = {
  clearEnv?: boolean;
  env?: Record<string, string>;
  cwd?: string;
  uid?: number;
  gid?: number;
  windowsRawArguments?: boolean;
};

// export const isDeno = typeof Deno !== "undefined";
// export const isBun = typeof Bun !== "undefined";
// export const isNode = typeof Node !== "undefined";

export const isDeno = typeof globalThis.Deno !== "undefined";
export const isBun = typeof globalThis.Bun !== "undefined";
export const isNode =
  typeof globalThis.process !== "undefined" &&
  !!globalThis.process.versions?.node;

export const getRuntime = (): "deno" | "bun" | "node" | "unknown" => {
  if (typeof globalThis.Deno !== "undefined") return "deno";
  if (typeof globalThis.Bun !== "undefined") return "bun";
  if (
    typeof globalThis.process !== "undefined" &&
    globalThis.process.versions?.node
  )
    return "node";
  return "unknown";
};

/* =========================
SAFE PROCESS SPAWNING
========================= */

export const isWindows = process.platform === "win32";
export const npmBin = isWindows ? "npm.cmd" : "npm";

export type {
  ParsedCommand,
  Flags,
  Config,
  TaskDef,
  PackageInfo,
  TaskName,
  Executor,
  NodeSandbox,
  SandboxConfig,
};
