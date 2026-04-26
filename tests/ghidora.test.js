import { test, expect } from "bun:test";

function runGhidrora(args) {
  return Bun.spawn(["node", "bundle.main.cjs", ...args], {
    cwd: import.meta.dir,
    stdout: "pipe",
    stderr: "pipe",
  });
}

async function readAll(stream) {
  return await new Response(stream).text();
}

test("ghidora help", async () => {
  const proc = runGhidrora(["help"]);
  const [stdout, stderr, code] = await Promise.all([
    readAll(proc.stdout),
    readAll(proc.stderr),
    proc.exited,
  ]);

  expect(code).toBe(0);
 // expect(stdout + stderr).toContain("DONE");
});

// test("ghidora exec works", async () => {
//   const proc = runGhidrora(["exec", "echo poda dei"]);
//   const [stdout, stderr, code] = await Promise.all([
//     readAll(proc.stdout),
//     readAll(proc.stderr),
//     proc.exited,
//   ]);

//   expect(code).toBe(0);
//   expect(stdout + stderr).toContain("poda dei");
// });