# @hyperforge/ghidora ⚡

> TypeScript CLI layer for Ghidora

[![npm version](https://img.shields.io/npm/v/@hyperforge/ghidora.svg)](https://www.npmjs.com/package/@hyperforge/ghidora)

---

## 🧠 Overview

This package implements the **CLI and orchestration layer** of Ghidora.

It is responsible for interacting with the host runtime and delegating
compute-heavy tasks to the WASM core.

---

## ⚙️ Responsibilities

* Workspace discovery across monorepo
* Task execution orchestration
* Cross-runtime process spawning
* Configuration parsing and normalization
* WASM module loading and invocation

---

## 🧩 Internal Structure (Conceptual)

```
src/
  cli/            → command entry + argument parsing
  runner/         → task execution engine
  workspace/      → project discovery logic
  process/        → cross-runtime spawn abstraction
  wasm/           → bindings to ghidora-core
```

---

## 🔌 Runtime Abstraction

The CLI is designed to work across:

* Node.js (child_process)
* Deno (Deno.Command / ChildProcess)
* Bun (spawn compatibility)

All runtime differences are normalized internally.

---

## ⚡ Execution Flow

```
CLI Entry
   ↓
Parse Config
   ↓
Discover Workspace
   ↓
Build Task Plan
   ↓
Call WASM (hash/cache)
   ↓
Execute Tasks
```

---

## 🧠 Design Notes

* No heavy logic in JS layer
* All critical computation delegated to Rust
* Minimal overhead for process management
* Sandbox-compatible execution model

---

## 📜 License

Apache-2.0
