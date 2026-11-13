import { spawn, type ChildProcess, type SpawnOptions } from "child_process";
import {
  isDeno,
  type Config,
  type Executor,
  type Flags,
  type NodeSandbox,
  type PackageInfo,
  type ParsedCommand,
  type SandboxConfig,
} from "../datatypes/validateDataTypes";
import fs from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";

const isWindows = process.platform === "win32";
const isBun = typeof Bun !== "undefined";

const getWindowsShell = (): string => {
  const comspec = process.env.ComSpec || process.env.COMSPEC;
  return comspec && comspec.length > 0 ? comspec : "cmd.exe";
};

const getPosixShell = (): string => "/bin/sh";

const minimalWindowsEnv = (): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = {};
  for (const key of ["PATH", "Path", "SystemRoot", "ComSpec", "COMSPEC"]) {
    const value = process.env[key];
    if (value) env[key] = value;
  }
  return env;
};

const buildNodeEnv = (
  baseEnv: NodeJS.ProcessEnv | undefined,
  sandbox?: NodeSandbox,
): NodeJS.ProcessEnv => {
  if (sandbox?.clearEnv) {
    return {
      ...minimalWindowsEnv(),
      ...(sandbox.env ?? {}),
      ...(baseEnv ?? {}),
    };
  }

  return {
    ...process.env,
    ...(sandbox?.env ?? {}),
    ...(baseEnv ?? {}),
  };
};

const buildDenoEnv = (
  baseEnv: Record<string, string> | undefined,
  sandbox?: SandboxConfig,
): Record<string, string> | undefined => {
  if (sandbox?.clearEnv) {
    const env: Record<string, string> = {};

    for (const key of ["PATH", "Path", "SystemRoot", "ComSpec", "COMSPEC"]) {
      const value = process.env[key];
      if (typeof value === "string" && value.length > 0) {
        env[key] = value;
      }
    }

    return {
      ...env,
      ...(sandbox.env ?? {}),
      ...(baseEnv ?? {}),
    };
  }

  return {
    ...(sandbox?.env ?? {}),
    ...(baseEnv ?? {}),
  };
};

export const loadConfig = async (): Promise<Config> => {
  const configPath = path.join(process.cwd(), "ghidora.config.mjs");
  const url = pathToFileURL(configPath).href + `?t=${Date.now()}`;
  const mod = await import(url);

  let raw: Partial<Config> | undefined;

  if (mod?.default) {
    raw = mod.default;
  } else if (mod && Object.keys(mod).length > 0) {
    raw = mod as Partial<Config>;
  }

  if (!raw) {
    throw new Error(`Failed to load config at ${configPath}`);
  }

  return {
    workspaceRoot:
      raw.workspaceRoot ??
      (typeof Deno !== "undefined" ? Deno.cwd() : process.cwd()),
    packages: raw.packages,
    totalParallelTasks: raw.totalParallelTasks,
    tasks: raw.tasks,
    cacheDir: raw.cacheDir ?? ".ghidora-cache",
    cloudCache: raw.cloudCache,
    executor: raw.executor ?? "npm",
    enableSandbox: raw.enableSandbox ?? false,
    sandbox: raw.sandbox ?? {},
    shell: raw.shell,
  };
};

/* =========================
SAFE PROCESS SPAWNING
========================= */

export const executorMap: Record<Executor, { bin: string; runArg: string }> = {
  npm: { bin: "npm", runArg: "run" },
  pnpm: { bin: "pnpm", runArg: "run" },
  yarn: { bin: "yarn", runArg: "run" },
  bun: { bin: "bun", runArg: "run" },
  deno: { bin: "deno", runArg: "task" },
};

export function getRunner(executor: string) {
  if (!(executor in executorMap)) {
    console.warn(`Unknown executor "${executor}", falling back to npm`);
    return executorMap.npm;
  }
  return executorMap[executor as keyof typeof executorMap];
}

type GhidoraConfig = {
  executor?: "npm" | "pnpm" | "yarn" | "bun" | "deno";
  enableSandbox?: boolean;
  sandbox?: SandboxConfig;
};

export const resolveUseShell = (
  command: string,
  args: string[],
  shell: boolean | "auto" | undefined,
): boolean => {
  if (shell === true) return true;
  if (shell === false) return false;

  const cmdStr = [command, ...args].join(" ");
  return /[&|<>^]/.test(cmdStr);
};

const mapNodeStdioToDeno = (
  value: unknown,
  fallback: "inherit" | "piped",
): "inherit" | "piped" | "null" => {
  if (value === "pipe" || value === "piped") return "piped";
  if (value === "ignore" || value === "null") return "null";
  if (value === "inherit") return "inherit";
  return fallback;
};

const resolveDenoStdio = (
  stdio: SpawnOptions["stdio"],
  interactive: boolean,
): {
  stdin: "inherit" | "piped" | "null";
  stdout: "inherit" | "piped" | "null";
  stderr: "inherit" | "piped" | "null";
} => {
  const fallback = interactive ? "inherit" : "piped";

  if (Array.isArray(stdio)) {
    return {
      stdin: mapNodeStdioToDeno(stdio[0], fallback),
      stdout: mapNodeStdioToDeno(stdio[1], fallback),
      stderr: mapNodeStdioToDeno(stdio[2], fallback),
    };
  }

  if (typeof stdio === "string") {
    const mode = mapNodeStdioToDeno(stdio, fallback);
    return {
      stdin: mode,
      stdout: mode,
      stderr: mode,
    };
  }

  return {
    stdin: fallback,
    stdout: fallback,
    stderr: fallback,
  };
};

export const spawnSafe = (
  command: string,
  args: string[] = [],
  options: SpawnOptions = {},
  sandbox?: NodeSandbox,
  _shellMode: boolean | "auto" = "auto",
): ChildProcess => {
  const finalOptions: SpawnOptions = {
    ...options,
    shell: false,
    cwd: options.cwd ?? sandbox?.cwd ?? process.cwd(),
    env: buildNodeEnv(options.env as NodeJS.ProcessEnv | undefined, sandbox),
    uid: isWindows || isBun ? undefined : sandbox?.uid,
    gid: isWindows || isBun ? undefined : sandbox?.gid,
    windowsHide: true,
  };
  finalOptions.stdio = options.stdio ?? ["inherit", "pipe", "pipe"];
  return spawn(command, args, finalOptions);
};

export const spawnShellCommand = (
  rawCommandLine: string,
  options: SpawnOptions = {},
  sandbox?: NodeSandbox,
  config?: Config,
): ChildProcess | Deno.ChildProcess => {
  if (config?.executor === "deno" && config?.enableSandbox) {
    if (!isDeno) {
      throw new Error("Sandbox mode requires Deno runtime");
    }

    const denoSandbox = config.sandbox ?? {};
    const shellCmd = isWindows ? getWindowsShell() : getPosixShell();
    const shellArgs = isWindows
      ? ["/d", "/s", "/c", rawCommandLine]
      : ["-c", rawCommandLine];

    const stdio = resolveDenoStdio(options.stdio, true);

    return new Deno.Command(shellCmd, {
      args: shellArgs,
      cwd: options.cwd ?? denoSandbox.cwd ?? Deno.cwd(),
      clearEnv: denoSandbox.clearEnv ?? false,
      env: buildDenoEnv(
        options.env as Record<string, string> | undefined,
        denoSandbox,
      ),
      stdin: stdio.stdin,
      stdout: stdio.stdout,
      stderr: stdio.stderr,
      windowsRawArguments: denoSandbox.windowsRawArguments ?? false,
      uid: isWindows ? undefined : denoSandbox.uid,
      gid: isWindows ? undefined : denoSandbox.gid,
    }).spawn();
  }

  const shellCmd = isWindows ? getWindowsShell() : getPosixShell();
  const shellArgs = isWindows
    ? ["/d", "/s", "/c", rawCommandLine]
    : ["-c", rawCommandLine];

  const finalOptions: SpawnOptions = {
    ...options,
    shell: false,
    cwd: options.cwd ?? sandbox?.cwd ?? process.cwd(),
    env: buildNodeEnv(options.env as NodeJS.ProcessEnv | undefined, sandbox),
    uid: isWindows || isBun ? undefined : sandbox?.uid,
    gid: isWindows || isBun ? undefined : sandbox?.gid,
    windowsHide: true,
  };

  // if (finalOptions.stdio === undefined) {
  //   finalOptions.stdio = "inherit";
  // }
  finalOptions.stdio = options.stdio ?? ["inherit", "pipe", "pipe"];

  return spawn(shellCmd, shellArgs, finalOptions);
};

export function spawnUnified(
  command: string,
  args: string[] = [],
  options: SpawnOptions = {},
  config?: Config,
) {
  if (config?.executor === "deno" && config?.enableSandbox) {
    return spawnSandboxed(command, args, options, config);
  }

  return spawnSafe(command, args, options, config?.sandbox);
}

export function spawnSandboxed(
  command: string,
  args: string[] = [],
  options: SpawnOptions = {},
  config: GhidoraConfig,
  _shellMode: boolean | "auto" = "auto",
): Deno.ChildProcess {
  if (!isDeno) {
    throw new Error("Sandbox mode requires Deno runtime");
  }

  const sandbox = config.sandbox ?? {};

  const stdio = resolveDenoStdio(options.stdio, false);

  const denoCmd = new Deno.Command(command, {
    args,
    cwd: (options.cwd as string) ?? sandbox.cwd ?? Deno.cwd(),
    clearEnv: sandbox.clearEnv ?? false,
    env: buildDenoEnv(
      options.env as Record<string, string> | undefined,
      sandbox,
    ),
    stdin: stdio.stdin,
    stdout: stdio.stdout,
    stderr: stdio.stderr,
    windowsRawArguments: sandbox.windowsRawArguments ?? false,
    uid: isWindows ? undefined : sandbox.uid,
    gid: isWindows ? undefined : sandbox.gid,
  });

  return denoCmd.spawn();
}

export const spawnPackageRunner = (
  executor: Executor,
  task: string,
  options: SpawnOptions = {},
  config?: Config,
): ChildProcess | Deno.ChildProcess => {
  const runner = getRunner(executor);

  const finalOptions: SpawnOptions = {
    ...options,
    cwd: options.cwd ?? config?.sandbox?.cwd ?? process.cwd(),

    // 🔥 FIXED (was "inherit")
    stdio: options.stdio ?? ["inherit", "pipe", "pipe"],
  };

  if (isWindows) {
    return spawnShellCommand(
      `${runner.bin} ${runner.runArg} ${task}`,
      finalOptions,
      config?.sandbox,
    );
  }

  return spawnSafe(
    runner.bin,
    [runner.runArg, task],
    finalOptions,
    config?.sandbox,
  );
};

/* =========================
CROSS-PLATFORM EVENT HANDLERS
========================= */

const decoder = new TextDecoder();

export const handleProcessEvents = (
  child: ChildProcess | Deno.ChildProcess,
  callbacks: {
    onStdout?: (d: string) => void;
    onStderr?: (d: string) => void;
    onError?: (err: Error) => void;
    onExit?: (code: number | null) => void;
  },
) => {
  // ✅ DENO PATH
  if ("status" in child) {
    // stdout
    if (callbacks.onStdout && child.stdout && "getReader" in child.stdout) {
      const reader = (child.stdout as ReadableStream<Uint8Array>).getReader();

      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              callbacks.onStdout!(decoder.decode(value, { stream: true }));
            }
          }
        } catch {
          // ignore stream errors
        } finally {
          reader.releaseLock(); // ✅ FIX
        }
      })();
    }

    // stderr
    if (callbacks.onStderr && child.stderr && "getReader" in child.stderr) {
      const reader = (child.stderr as ReadableStream<Uint8Array>).getReader();

      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              callbacks.onStderr!(decoder.decode(value, { stream: true }));
            }
          }
        } catch {
          // ignore stream errors
        } finally {
          reader.releaseLock(); // ✅ FIX
        }
      })();
    }

    child.status
      .then((s) => callbacks.onExit?.(s.code))
      .catch((e) => callbacks.onError?.(e));

    return;
  }

  // ✅ NODE PATH
  const nodeChild = child as ChildProcess;

  if (callbacks.onStdout && nodeChild.stdout) {
    nodeChild.stdout.on("data", (d) => {
      callbacks.onStdout!(d.toString());
    });
  }

  if (callbacks.onStderr && nodeChild.stderr) {
    nodeChild.stderr.on("data", (d) => {
      callbacks.onStderr!(d.toString());
    });
  }

  if (callbacks.onError) {
    nodeChild.on("error", callbacks.onError);
  }

  if (callbacks.onExit) {
    nodeChild.on("exit", (code) => callbacks.onExit!(code));
  }
};

export const killProcess = (
  child: ChildProcess | Deno.ChildProcess,
  signal: string = "SIGINT",
) => {
  if ("status" in child) {
    try {
      child.kill(signal as any);
    } catch {}
  } else {
    const nodeChild = child as ChildProcess;
    if (!nodeChild.killed) {
      try {
        nodeChild.kill(signal as any);
      } catch {}
    }
  }
};

export const waitForExit = (
  child: ChildProcess | Deno.ChildProcess,
  label: string,
  noBail = false,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    if ("status" in child) {
      child.status
        .then((res) => {
          if (res.success || noBail) resolve();
          else reject(new Error(`${label} failed (${res.code ?? "unknown"})`));
        })
        .catch(reject);
      return;
    }

    child.once("error", reject);
    child.once("exit", (code: number) => {
      if (code === 0 || noBail) resolve();
      else reject(new Error(`${label} failed (${code ?? "unknown"})`));
    });
  });
};

export const parseCommandLine = (input: unknown): ParsedCommand => {
  const text = String(input ?? "").trim();
  if (!text) throw new Error("exec requires a command");

  const args: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);

    if (escape) {
      current += ch;
      escape = false;
      continue;
    }

    if (ch === "\\") {
      escape = true;
      continue;
    }

    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    if (/\s/.test(ch)) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += ch;
  }

  if (escape) current += "\\";
  if (quote) throw new Error("Unclosed quote in exec command");
  if (current) args.push(current);

  if (args.length === 0) throw new Error("exec requires a command");

  const [command, ...rest] = args;
  if (!command) throw new Error("exec requires a command");

  return { command, args: rest };
};

/* =========================
CLI ARG PARSING
========================= */

export const argv = process.argv.slice(2);
export const rawCmd = argv[0];
export const rawArg = argv[1];

export const flags: Flags = {
  noCache: argv.includes("--no-cache"),
  dryRun: argv.includes("--dry-run"),
  noBail: argv.includes("--no-bail"),
  affected: argv.includes("--affected"),
  scopes: null,
};

/* =========================
PACKAGE TASK RUNNER
========================= */

export const runTask = async (
  pkg: PackageInfo,
  task: string,
  executor: Executor,
  config?: Config,
): Promise<void> => {
  let pkgJson;

  try {
    pkgJson = JSON.parse(await fs.readFile(`${pkg.path}/package.json`, "utf8"));
  } catch {
    console.log(`↷ skipping ${pkg.name}`);
    return;
  }

  if (!pkgJson.scripts?.[task]) {
    console.log(`↷ skipping ${pkg.name}:${task}`);
    return;
  }

  const child = spawnPackageRunner(
    executor,
    task,
    { cwd: pkg.path }, // no need to pass stdio now
    config,
  );

  // 🔥 THIS WAS MISSING
  handleProcessEvents(child, {
    onStdout: (d) => process.stdout.write(d),
    // /process.stdout.write(d.endsWith("\n") ? d : d);
    onStderr: (d) => process.stderr.write(d),
  });

  await waitForExit(child, `${pkg.name}:${task}`);
};

export const parsePkgTask = (
  input: string,
): { pkgName: string; task: string } => {
  const text = String(input ?? "").trim();
  const i = text.indexOf(":");

  if (i === -1) {
    throw new Error(`Invalid target "${input}". Use <pkg>:<task>`);
  }

  return {
    pkgName: text.slice(0, i),
    task: text.slice(i + 1),
  };
};
