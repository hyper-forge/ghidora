use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

//// ------------------------------
///  Package.json GENERATORS
/// -------------------------------
#[wasm_bindgen]
pub fn get_package_template(kind: &str, name: &str) -> String {
    match kind {
        "app" => format!(
            r#"{{
  "name": "{}",
  "version": "0.0.1",
  "scripts": {{
    "build": "echo build app"
  }}
}}"#,
            name
        ),

        "lib" => format!(
            r#"{{
  "name": "{}",
  "version": "0.0.1",
  "scripts": {{
    "build": "echo build lib"
  }}
}}"#,
            name
        ),

        _ => format!(
            r#"{{
  "name": "{}",
  "version": "0.0.1"
}}"#,
            name
        ),
    }
}

/// -------------------------------
/// TypeScript configs
/// -------------------------------

pub const TSCONFIG_LIB: &str = r#"{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "isolatedModules": true,
    "noEmit": false,
    "verbatimModuleSyntax": true,
    "outDir": "dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}"#;

pub const TSCONFIG_APP: &str = r#"{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src"]
}"#;

/// -------------------------------
/// Esbuild config template
/// -------------------------------
/// NOTE:
/// - This is JS code, not executed in WASM
/// - JS side writes it to disk or evals it
/// - Mode is injected by JS (dev / prod)


pub const ESBUILD_CONFIG: &str = r#"
import esbuild from 'esbuild';
import pkg from './package.json' with { type: 'json' };
// import pkg from './package.json' assert { type: 'json' };  // OLD node 16

const {
  dependencies = {},
  devDependencies = {},
  peerDependencies = {} 
} = pkg;

const externals = [
  ...Object.keys(dependencies),
  ...Object.keys(devDependencies),
  ...Object.keys(peerDependencies)
];

const isDev = process.env.NODE_ENV === 'development';

const ctx = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'dist/bundle.js',
  platform: 'node',
  format: 'esm',
  sourcemap: isDev,
  minify: !isDev,
  external: externals,
  target: 'es2022'
});

if (isDev) {
  console.log('[esbuild] watch mode');
  await ctx.watch();
} else {
  console.log('[esbuild] production build');
  await ctx.rebuild();
  await ctx.dispose();
}
"#;

pub const GHIDORA_ROOT: &str = r#"
export default {
  // Root of the monorepo
  workspaceRoot: process.cwd(),
  totalParallelTasks: 3,

  // Package discovery (JS, Rust, Go, Python, anything)
  packages: [
    "packages/*",
    "apps/*"
  ],

  // Local deterministic cache (WASM tar/targz)
  cacheDir: ".ghidora/cache",
  cloudCache: {
    enabled: false,
    url: "http://localhost:4000",
    token: "secret123", // optional
  },
  executor: "npm",
  shell: true,          // opens for raw exec cmds 
  // enableSandbox: false,
  // sandbox: {
  //   cwd: process.cwd(),
  //   clearEnv: true,  // Deno.Command will always respect this config regardless of sandbox.
  //   env: {
  //     GHIDORA_ENV: "Safe Env from Deno Sandbox via GHIDORA",

  //     PATH: [
  //      // your allowed bin paths
  //     ].join(";")
  //   },
    windowsRawArguments: true,  // Deno Safe WIN Spawn
  },

  // ONLY tasks declared here get:
  // - DAG ordering
  // - caching
  // - guarantees
  //
  // Undeclared tasks still run (lerna-style),
  // but WITHOUT cache or DAG.
  tasks: {
    build: {
      inputs: [
        "src",
        "Cargo.toml",
        "Cargo.lock",
        "package.json"
      ],
      // Files produced by build (per package)
      // Used ONLY for cache save/restore
      outputs: [
        "dist",
        "build",
        "out",
        "target/release"
      ],

      // Run test on dependency packages first
     // dependsOn: ["test"]
    },

    test: {
      // Tests require build to have run
      dependsOn: ["build"]
    },

    dev: {
      // Long-running (watch / dev servers)
      persistent: true
    },

    serve: {
      // Runtime servers (frontend / backend)
      persistent: true
    }
  }
};
"#;

/* =========================
STRUCTS (match your TS payload)
========================= */

#[derive(Serialize, Deserialize)]
pub struct TaskNode {
    pub id: String,
    pub pkg: String,
    pub task: String,
    pub depends_on: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct PackageCard {
    pub name: String,
    pub deps: Vec<String>,
    pub description: String,
    pub version: String,
    pub private: bool,
    pub kind: String,
    pub homepage: String,
    pub repository: String,
    pub tasks: usize,
}

#[derive(Serialize, Deserialize)]
pub struct GraphPayload {
    pub nodes: Vec<TaskNode>,
    pub packages: Vec<PackageCard>,
    pub initial_selected_id: String,
}
/* =========================
HTML TEMPLATE
========================= */

pub const GHIDORA_GRAPHUI: &str = include_str!("graphui.html");

/* =========================
SAFE JSON (prevent </script> break)
========================= */

fn safe_json<T: Serialize>(data: &T) -> String {
    serde_json::to_string(data).unwrap().replace("<", "\\u003c")
}

/// -------------------------------
/// Log color logic
/// -------------------------------

#[wasm_bindgen]
#[repr(u8)]
#[derive(Clone, Copy, Debug)]
pub enum LogColor {
    Gray = 0,
    Red = 1,
    Green = 2,
    Yellow = 3,
    Blue = 4,
    Magenta = 5,
    Cyan = 6,
}

#[wasm_bindgen]
pub fn pick_color(name: &str) -> u8 {
    let mut hash: u32 = 2166136261;
    for &b in name.as_bytes() {
        hash ^= b as u32;
        hash = hash.wrapping_mul(16777619);
    }
    (hash % 7) as u8
}

/// -------------------------------
/// Public config API
/// -------------------------------

#[wasm_bindgen]
pub fn get_tsconfig(kind: &str) -> String {
    match kind {
        "library" | "lib" => TSCONFIG_LIB.to_owned(),
        _ => TSCONFIG_APP.to_owned(),
    }
}

#[wasm_bindgen]
pub fn get_esbuild_config() -> String {
    ESBUILD_CONFIG.to_owned()
}

#[wasm_bindgen]
pub fn get_ghidora_config() -> String {
    GHIDORA_ROOT.to_owned()
}

#[wasm_bindgen]
pub fn generate_graphui(payload: JsValue) -> String {
    let payload: GraphPayload = serde_wasm_bindgen::from_value(payload).unwrap();

    let json = safe_json(&payload);

    GHIDORA_GRAPHUI.replace("__GHIDORA_DATA__", &json)
}
