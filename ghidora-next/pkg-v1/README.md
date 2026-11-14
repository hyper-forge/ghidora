# Ghidora ⚡

**Zero-dependency monorepo build system powered by Rust + WASM**

Ghidora is a high-performance build system designed for modern monorepos.
It combines native Rust execution with a lightweight WASM bridge to JavaScript—delivering fast, deterministic builds without dependency bloat.

---

## 🚀 Why Ghidora?

Most build tools depend heavily on large JavaScript ecosystems.
Ghidora takes a different path:

- ⚡ **Rust-powered execution engine** — near-native performance
- 🧩 **WASM bridge** — minimal, controlled JS interoperability
- 📦 **Zero-dependency philosophy** — no runtime overhead
- 🔁 **Deterministic task graph** — predictable, repeatable builds
- 🧠 **Smart orchestration** — only run what’s necessary

---

## ⚡ Installation

### Global install

```bash
npm install -g @hyperforge/ghidora
```

### One-time usage

```bash
npx @hyperforge/ghidora init
```

---

## 🛠 Usage

Initialize a workspace:

```bash
ghidora init
ghidora init --app test
```

Run tasks:

```bash
ghidora run build
ghidora run test
```

Development mode:

```bash
ghidora dev
```

---

## 🧩 Example Configuration

```json
{
  "ghidoraconfig": {
    "dependsOn": {
      "build": ["core:check"]
    }
  }
}
```

---

## ⚙️ How It Works

1. Ghidora scans your workspace
2. Builds a dependency graph of tasks
3. Executes tasks using a Rust core scheduler
4. Uses WASM only where JavaScript is required

Result: **maximum speed with minimal overhead**

---

## 🧠 Philosophy

- **Speed is a feature**
- **Native > interpreted**
- **Minimalism over complexity**
- **Determinism over magic**

---

## 🆚 Comparison

| Feature           | Ghidora | Turborepo | Nx  |
| ----------------- | ------- | --------- | --- |
| Native core       | ✅      | ❌        | ❌  |
| Zero dependencies | ✅      | ❌        | ❌  |
| WASM bridge       | ✅      | ❌        | ❌  |
| Cold start        | ⚡      | ⚠️        | ⚠️  |

---

## 🧪 Status

> Early stage — APIs may evolve.

---

## 🤝 Contributing

Contributions are welcome.

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.

---

## 📄 License

Licensed under the Apache License, Version 2.0.

---

## 🔥 Vision

Ghidora aims to redefine how monorepos are built:
fast, minimal, and powered by native performance.

---
