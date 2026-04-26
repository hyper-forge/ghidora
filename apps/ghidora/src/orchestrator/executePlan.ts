// orchestrator/executePlan.ts

export type ExecutePlanOptions<T> = {
  targets: T[];
  parallel: number;
  noBail?: boolean;
  dryRun?: boolean;
  runTarget: (target: T) => Promise<void>;
  onBeforeTarget?: (target: T) => Promise<void> | void;
  onAfterTarget?: (target: T) => Promise<void> | void;
};

export function limitConcurrency(limit: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  return <T>(fn: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        if (active >= limit) {
          queue.push(run);
          return;
        }

        active++;

        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            if (queue.length) queue.shift()!();
          });
      };

      run();
    });
}

export async function executePlan<T>({
  targets,
  parallel,
  noBail,
  dryRun,
  runTarget,
  onBeforeTarget,
  onAfterTarget,
}: ExecutePlanOptions<T>): Promise<void> {
  if (dryRun) {
    console.log(targets);
    return;
  }

  const limit = limitConcurrency(Math.max(1, parallel));

  const jobs = targets.map((target) =>
    limit(async () => {
      if (onBeforeTarget) await onBeforeTarget(target);
      await runTarget(target);
      if (onAfterTarget) await onAfterTarget(target);
    }),
  );

  if (noBail) {
    await Promise.allSettled(jobs);
  } else {
    await Promise.all(jobs);
  }
}

export const dedupeTargets = (targets: string[]) => {
  const seen = new Set();

  const uniqueTargets = targets.filter((t) => {
    if (seen.has(t)) {
      console.warn(`⚠ duplicate target ignored: ${t}`);
      return false;
    }
    seen.add(t);
    return true;
  });

  return uniqueTargets; // ✅ IMPORTANT
};
