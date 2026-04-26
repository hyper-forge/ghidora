// import type { ChildProcess } from "child_process";

// export type GhidoraChild =
//   | {
//       type: "node";
//       proc: ChildProcess;
//     }
//   | {
//       type: "deno";
//       proc: any; // Deno.ChildProcess (no TS dependency)
//     };

// export const isDenoRuntime = (): boolean => {
//   const D = (globalThis as any).Deno;
//   return Boolean(D?.Command);
// };

// export const createNodeChild = (proc: ChildProcess): GhidoraChild => ({
//   type: "node",
//   proc,
// });

// export const createDenoChild = (proc: any): GhidoraChild => ({
//   type: "deno",
//   proc,
// });

// /* =========================
// OUTPUT HANDLING
// ========================= */

// export async function attachOutput(
//   child: GhidoraChild,
//   prefix: string,
// ): Promise<void> {
//   if (child.type === "node") {
//     child.proc.stdout?.on("data", (d: Buffer) => {
//       process.stdout.write(prefix + d.toString());
//     });
//     child.proc.stderr?.on("data", (d: Buffer) => {
//       process.stderr.write(prefix + d.toString());
//     });
//     return;
//   }

//   const decoder = new TextDecoder();
//   const pump = async (
//     stream: ReadableStream<Uint8Array> | undefined,
//     write: (s: string) => void,
//   ) => {
//     if (!stream) return;
//     const reader = stream.getReader();
//     try {
//       while (true) {
//         const { value, done } = await reader.read();
//         if (done) break;
//         if (value) write(decoder.decode(value, { stream: true }));
//       }
//     } finally {
//       reader.releaseLock();
//     }
//   };

//   void pump(child.proc.stdout, (t) => process.stdout.write(prefix + t));
//   void pump(child.proc.stderr, (t) => process.stderr.write(prefix + t));
// }
// /* =========================
// WAIT / EXIT HANDLING
// ========================= */

// export async function waitForExit(
//   child: GhidoraChild,
//   label: string,
//   noBail = false,
// ): Promise<void> {
//   if (child.type === "node") {
//     return new Promise((resolve, reject) => {
//       child.proc.once("error", reject);
//       child.proc.once("exit", (code) => {
//         if (code === 0 || noBail) resolve();
//         else reject(new Error(`${label} failed (${code ?? "unknown"})`));
//       });
//     });
//   }

//   const status = await child.proc.status;
//   if (status.code === 0 || noBail) return;
//   throw new Error(`${label} failed (${status.code ?? "unknown"})`);
// }
