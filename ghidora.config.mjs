
export default {
  // Root of the monorepo
  workspaceRoot: process.cwd(),
  totalParallelTasks: 1,

  // Package discovery (JS, Rust, Go, Python, anything)
  packages: [
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
  shell: true,          // only bun and node obeys 
  enableSandbox: false,
  sandbox: {
    cwd: process.cwd(),
    clearEnv: true,       // Deno.Command will always respect this config regardless of sandbox.
    //   env: {
    //     POTTA: "POTTA_____________________ENV",
    //     PATH: [
    //       "C:/Program Files/nodejs",
    //       "D:/Program Files2/Git/cmd",
    //       "C:/Windows/System32",
    //       "C:/ProgramData/chocolatey/lib/deno",   // 👈 add this
    //       "C:/Users/HP/.deno/bin",
    //       "C:/Users/HP/.cargo/bin",
    //       "C:/Users/HP/.bun/bin"            // 👈 add this
    //     ].join(";"),
    //   //  SystemRoot: process.env.SystemRoot ?? "",
    //   //  ComSpec: process.env.ComSpec ?? "",
    //  //   USERPROFILE: process.env.USERPROFILE ?? "",
    //  //   APPDATA: process.env.APPDATA ?? "",
    //   },
    //  uid: 1000,
    //  gid: 1000,
    env: {
      POTTA: "POTTA_____________________ENV",

      PATH: [
        "C:/Program Files/nodejs",
        "D:/Program Files2/Git/cmd",
        "C:/Windows/System32",
        "C:/ProgramData/chocolatey/lib/deno",
        "C:/Users/HP/.deno/bin",
        "C:/Users/HP/.cargo/bin",
        "C:/Users/HP/.bun/bin"
      ].join(";"),

      USERPROFILE: process.env.USERPROFILE,
      HOMEDRIVE: process.env.HOMEDRIVE,
      HOMEPATH: process.env.HOMEPATH,
      APPDATA: process.env.APPDATA,

      RUSTUP_HOME: "C:/Users/HP/.rustup",
      CARGO_HOME: "C:/Users/HP/.cargo",

      // 🔥 THESE ARE THE MISSING PIECES
      SystemRoot: process.env.SystemRoot,
      ComSpec: process.env.ComSpec,
      PATHEXT: process.env.PATHEXT,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
    },
    windowsRawArguments: true,
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
        "target/wasm32-unknown-unknown/release/ghidora.wasm",
        "pkg"
      ],

      // Run test on dependency packages first
      //  dependsOn: ["check"]
    },
    check: {
      // Tests require build to have run
      dependsOn: ["build"]
    },

    test: {
      // Tests require build to have run
      // dependsOn: ["build"]
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
