# Ghidora ⚡

> Zero-dependency monorepo orchestrator powered by Rust + WASM → JS

[![npm version](https://img.shields.io/npm/v/@hyperforge/ghidora.svg)](https://www.npmjs.com/package/@hyperforge/ghidora)

---

## 🧠 Overview

Ghidora is a **cross-runtime build orchestration system** designed with a split architecture:

* **TypeScript CLI layer** → orchestration & runtime handling
* **Rust core (via WASM)** → deterministic computation & hashing

This separation allows Ghidora to remain:

* Runtime-agnostic (Node, Bun, Deno)
* Dependency-free at execution level
* Highly performant

---

## 📁 Repository Structure

```
apps/
  ghidora/        → CLI layer (TypeScript)
  ghidora-core/   → Rust engine compiled to WASM
```

---

## 🧩 Package Breakdown

### `apps/ghidora` — CLI Layer

Handles all **runtime-facing responsibilities**:

* Workspace discovery
* Task orchestration
* Process spawning abstraction
* Config parsing
* WASM bridge integration

This layer is intentionally lightweight and avoids heavy logic.

---

### `apps/ghidora-core` — Rust Engine

Core computation layer responsible for:

* Blake3 hashing
* Cache key generation
* Deterministic computation
* Future task graph execution

Compiled to **WebAssembly** for portability across runtimes.

---

## 🧠 Architecture

```
TypeScript CLI
      ↓
WASM Bridge
      ↓
Rust Core
```

---

## ⚡ Design Principles

* **Zero dependencies** — no runtime bloat
* **Deterministic execution** — reproducible builds
* **Portable compute layer** — via WASM
* **Runtime independence** — Node, Bun, Deno


---

## 📜 License

Apache-2.0 © 2026 Hyperforge
