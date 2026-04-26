
export default {
  // Root of the monorepo
  workspaceRoot: process.cwd(),
  totalParallelTasks: 10,

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
