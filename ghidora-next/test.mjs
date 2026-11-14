// // UNIT Tests Yet to come for comparing wasm-pack V.S. boltffi

// import * as tuiNext from "./pkg-next/node.js"
// import * as tuiOld from "./pkg-v1/ghidora.js"


// console.log(tuiNext.ghidoraLogo(), tuiOld.ghidora_logo())
// console.log(tuiNext.boxUi("PODA", "PUNDA"), tuiOld.box_ui("PODA", "PUNDA"))


import { performance } from "node:perf_hooks";

import * as tuiNext from "./pkg-next/node.js";
import * as tuiOld from "./pkg-v1/ghidora.js";

const ITERATIONS = 1_0000;
const WARMUP_ITERATIONS = 5_000;
const SAMPLES = 30;

const results = {
  boltffi: {},
  wasmPack: {},
};

let checksum = 0;

// Prevent benchmark results from being ignored.
const consume = (value) => {
  if (typeof value === "string") {
    checksum = (checksum + value.length) | 0;
  } else if (value != null) {
    checksum = (checksum + String(value).length) | 0;
  }
};

const stats = (values) => {
  const sorted = [...values].sort((a, b) => a - b);

  const sum = sorted.reduce((a, b) => a + b, 0);

  const percentile = (p) =>
    sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];

  return {
    min: sorted[0],
    avg: sum / sorted.length,
    median: percentile(0.5),
    p95: percentile(0.95),
    max: sorted.at(-1),
  };
};

const benchmark = (name, fn) => {
  console.log(`\nBenchmarking ${name}...`);

  // Warm-up: allow V8 to optimize hot paths.
  for (let i = 0; i < WARMUP_ITERATIONS; i++) {
    consume(fn());
  }

  const samples = [];

  for (let sample = 0; sample < SAMPLES; sample++) {
    const start = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
      consume(fn());
    }

    const elapsed = performance.now() - start;

    // Average milliseconds per invocation.
    samples.push((elapsed * 1000) / ITERATIONS);
  }

  const s = stats(samples);

  const result = {
    iterations: ITERATIONS,
    samples: SAMPLES,
    min_us: s.min,
    avg_us: s.avg,
    median_us: s.median,
    p95_us: s.p95,
    max_us: s.max,
    ops_per_sec: 1_000_000 / s.median,
  };

  console.log(result);

  return result;
};

// ============================================
// BENCHMARK FUNCTIONS
// ============================================

const tests = [
  {
    name: "ghidoraLogo",
    next: () => tuiNext.ghidoraLogo(),
    old: () => tuiOld.ghidora_logo(),
  },
  {
    name: "boxUi",
    next: () => tuiNext.boxUi("PODA", "PUNDA"),
    old: () => tuiOld.box_ui("PODA", "PUNDA"),
  },
];

// ============================================
// CORRECTNESS TEST
// ============================================

console.log("\n========== CORRECTNESS ==========\n");

for (const test of tests) {
  const nextResult = test.next();
  const oldResult = test.old();

  const equal = nextResult === oldResult;

  console.log(`${test.name}: ${equal ? "PASS" : "FAIL"}`);

  if (!equal) {
    console.log("BoltFFI:", nextResult);
    console.log("wasm-pack:", oldResult);
    throw new Error(`${test.name} output mismatch`);
  }
}

// ============================================
// PERFORMANCE BENCHMARK
// ============================================

console.log("\n========== PERFORMANCE ==========\n");

for (const test of tests) {
  console.log(`\n========== ${test.name} ==========`);

  // Alternate order to reduce ordering bias.
  const nextSamples = [];
  const oldSamples = [];

  for (let i = 0; i < SAMPLES; i++) {
    const order = i % 2 === 0
      ? [
          ["boltffi", test.next, nextSamples],
          ["wasmPack", test.old, oldSamples],
        ]
      : [
          ["wasmPack", test.old, oldSamples],
          ["boltffi", test.next, nextSamples],
        ];

    for (const [, fn, samples] of order) {
      const start = performance.now();

      for (let j = 0; j < ITERATIONS; j++) {
        consume(fn());
      }

      samples.push(
        ((performance.now() - start) * 1000) / ITERATIONS
      );
    }
  }

  // Separate warm-up is required before measured runs.
  // The initial measured samples above are discarded.
  // Use the remaining samples for reporting.
  const next = stats(nextSamples.slice(5));
  const old = stats(oldSamples.slice(5));

  const toResult = (s) => ({
    min_us: s.min,
    avg_us: s.avg,
    median_us: s.median,
    p95_us: s.p95,
    max_us: s.max,
    ops_per_sec: 1_000_000 / s.median,
  });

  results.boltffi[test.name] = toResult(next);
  results.wasmPack[test.name] = toResult(old);

  console.table([
    {
      implementation: "BoltFFI",
      median_us: next.median.toFixed(4),
      p95_us: next.p95.toFixed(4),
      ops_sec: Math.round(1_000_000 / next.median),
    },
    {
      implementation: "wasm-pack",
      median_us: old.median.toFixed(4),
      p95_us: old.p95.toFixed(4),
      ops_sec: Math.round(1_000_000 / old.median),
    },
  ]);

  const speedup = old.median / next.median;

  console.log(
    speedup >= 1
      ? `BoltFFI is ${(speedup).toFixed(2)}x faster`
      : `wasm-pack is ${(1 / speedup).toFixed(2)}x faster`
  );
}

// ============================================
// FINAL REPORT
// ============================================

console.log("\n========== FINAL REPORT ==========\n");

console.log(JSON.stringify({
  configuration: {
    iterations_per_sample: ITERATIONS,
    samples_per_function: SAMPLES - 5,
    discarded_samples: 5,
    warmup_iterations: WARMUP_ITERATIONS,
  },
  results,
  checksum,
}, null, 2));
