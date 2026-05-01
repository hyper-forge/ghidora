# ghidora-core 🦀

> Rust + WASM computation engine for Ghidora

[![npm version](https://img.shields.io/npm/v/@hyperforge/ghidora.svg)](https://www.npmjs.com/package/@hyperforge/ghidora)

---

## 🧠 Overview

`ghidora-core` is the **low-level computation engine** of Ghidora.

Written in Rust and compiled to WebAssembly, it provides a
deterministic and high-performance foundation for build orchestration.

---

## ⚡ Responsibilities

* Cryptographic hashing (Blake3)
* Cache key computation
* Deterministic input processing
* Foundation for task graph execution (future)

---

## 🧩 Internal Structure (Conceptual)

```
src/
  hashing/        → Blake3 implementation
  cache/          → key derivation logic
  wasm/           → WASM bindings interface
  utils/          → shared helpers
```

---

## 🌍 WASM Integration

The core is compiled into:

* `.wasm` binary
* JS bindings for runtime consumption

This allows execution across:

* Node.js
* Deno
* Bun

without native bindings.

---

## ⚡ Build Targets

### Native

```
cargo build --release
```

### WebAssembly

```
wasm-pack build
```

---

## 🧠 Design Principles

* Deterministic computation
* Memory safety (Rust)
* Zero runtime dependencies
* Cross-platform portability

---

## 📌 Future Scope

* Task graph engine
* Incremental computation layer
* Remote cache protocol primitives

---

## 📜 License

Apache-2.0
