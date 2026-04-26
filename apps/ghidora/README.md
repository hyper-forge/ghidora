# Ghidora CLI

Node.js CLI for Ghidora.

---

## 📦 Install

```bash
npm install -g ghidora
```

or

```bash
npx ghidora
```

---

## ⚡ Commands

### Init

```bash
ghidora init --app=my-app
ghidora init --lib=my-lib
```

### Run

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

## ⚙️ Config

ghidora.config.mjs

```js
export default {
  tasks: {
    build: { command: "tsc" },
    test: { command: "node test.js" }
  }
}
```

---

## 🧠 Notes

* Thin CLI wrapper
* Delegates to Rust core

---

## 📜 License

Apache-2.0 © 2026 Shayam Murali
