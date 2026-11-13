use serde::Serialize;

// ============================================================
// PACKAGE.JSON GENERATORS
// ============================================================

#[boltffi::export]
pub fn get_package_template(kind: String, name: String) -> String {
    // Escape the package name as a valid JSON string.
    let name = serde_json::to_string(&name).expect("String serialization cannot fail");

    match kind.as_str() {
        "app" => format!(
            r#"{{
  "name": {name},
  "version": "0.0.1",
  "scripts": {{
    "build": "echo build app"
  }}
}}"#
        ),

        "lib" => format!(
            r#"{{
  "name": {name},
  "version": "0.0.1",
  "scripts": {{
    "build": "echo build lib"
  }}
}}"#
        ),

        _ => format!(
            r#"{{
  "name": {name},
  "version": "0.0.1"
}}"#
        ),
    }
}

// ============================================================
// TYPESCRIPT CONFIGS
// ============================================================

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

// ============================================================
// ESBUILD CONFIG
// ============================================================

pub const ESBUILD_CONFIG: &str = r#"
import esbuild from 'esbuild';
import pkg from './package.json' with { type: 'json' };

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

// ============================================================
// GHIDORA ROOT CONFIG
// ============================================================

pub const GHIDORA_ROOT: &str = r#"
export default {
  workspaceRoot: process.cwd(),
  totalParallelTasks: 3,

  packages: [
    "packages/*",
    "apps/*"
  ],

  cacheDir: ".ghidora/cache",

  cloudCache: {
    enabled: false,
    url: "http://localhost:4000",
    token: "secret123",
  },

  executor: "npm",
  shell: true,

  tasks: {
    build: {
      inputs: [
        "src",
        "Cargo.toml",
        "Cargo.lock",
        "package.json"
      ],

      outputs: [
        "dist",
        "build",
        "out",
        "target/release"
      ],
    },

    test: {
      dependsOn: ["build"]
    },

    dev: {
      persistent: true
    },

    serve: {
      persistent: true
    }
  }
};
"#;

// ============================================================
// GRAPH DATA MODELS
// ============================================================

#[boltffi::data]
#[derive(Serialize)]
pub struct TaskNode {
    pub id: String,
    pub pkg: String,
    pub task: String,
    pub depends_on: Vec<String>,
}

#[boltffi::data]
#[derive(Serialize)]
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

#[boltffi::data]
#[derive(Serialize)]
pub struct GraphPayload {
    pub nodes: Vec<TaskNode>,
    pub packages: Vec<PackageCard>,
    pub initial_selected_id: String,
}

// ============================================================
// GRAPH HTML TEMPLATE
// ============================================================

pub const GHIDORA_GRAPHUI: &str = include_str!("graphui.html");

// ============================================================
// SAFE JSON
// ============================================================

fn safe_json<T: Serialize>(data: &T) -> String {
    serde_json::to_string(data)
        .expect("Graph payload serialization failed")
        .replace('<', "\\u003c")
        .replace('>', "\\u003e")
        .replace('&', "\\u0026")
}

// ============================================================
// LOG COLOR
// ============================================================

#[derive(Clone, Copy, Debug)]
#[repr(u8)]
pub enum LogColor {
    Gray = 0,
    Red = 1,
    Green = 2,
    Yellow = 3,
    Blue = 4,
    Magenta = 5,
    Cyan = 6,
}

#[boltffi::export]
pub fn pick_color(name: String) -> u8 {
    let mut hash: u32 = 2166136261;

    for &b in name.as_bytes() {
        hash ^= b as u32;
        hash = hash.wrapping_mul(16777619);
    }

    (hash % 7) as u8
}

// ============================================================
// PUBLIC CONFIG API
// ============================================================

#[boltffi::export]
pub fn get_tsconfig(kind: String) -> String {
    match kind.as_str() {
        "library" | "lib" => TSCONFIG_LIB.to_owned(),
        _ => TSCONFIG_APP.to_owned(),
    }
}

#[boltffi::export]
pub fn get_esbuild_config() -> String {
    ESBUILD_CONFIG.to_owned()
}

#[boltffi::export]
pub fn get_ghidora_config() -> String {
    GHIDORA_ROOT.to_owned()
}

// ============================================================
// GRAPH UI GENERATOR
// ============================================================

#[boltffi::export]
pub fn generate_graphui(payload: GraphPayload) -> String {
    let json = safe_json(&payload);

    GHIDORA_GRAPHUI.replace("__GHIDORA_DATA__", &json)
}
