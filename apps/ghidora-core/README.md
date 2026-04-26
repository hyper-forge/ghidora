# Ghidora Core 🦀

Rust crypto engine powering Ghidora.

---

## ⚡ Features

* 🚀 Fast execution
* 🧠 Caching
* 📦 WASM compatible
* 🔒 Deterministic
* 🔒 Stable across Deno, Bun, Node, PNPM and Yarn

---

## 🛠 Build

```bash
cargo build --release
```

---

## 🧪 WASM

```bash
wasm-pack build --target nodejs
```

---

## 🔌 Usage

```js
import init from "./pkg/ghidora_core.js";
await init();
```

---

## 🧠 Architecture

Node CLI
↓
WASM
↓
Rust Core

---

## 📜 License

Apache-2.0 © 2026 Shayam Murali
