# Ghidora ⚡

> Zero-dependency monorepo orchestrator powered by Rust + WASM => JS

---

## 🚀 Features

* ⚡ Blazing fast task execution (Rust core)
* 📦 Workspace discovery
* 🧠 Smart caching
* 🔌 Zero dependencies
* 🧩 Works with Node, Bun, Deno

---

## 📁 Structure

apps/
ghidora/        → CLI
ghidora-core/   → Rust crypto engine

---

## ⚡ Usage

```bash
npx ghidora init --app=my-app
```

```bash
ghidora run build
ghidora run test
```

---

## 🧪 Example

```bash
ghidora init --app=demo
cd demo
ghidora run build
```

---

## 🧠 Architecture

CLI → WASM → Rust Core

---

## 📌 Roadmap

* Remote cache (Bazel-style)
* Distributed execution
* Graph visualization

---

## 📜 License

Apache-2.0 © 2026 Hyperforge
