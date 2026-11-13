
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
