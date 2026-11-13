import { Workout, Step, Segment } from './types';

export const fmt = (s: number) => `${Math.floor(Math.max(0, s) / 60).toString().padStart(2, "0")}:${(Math.max(0, s) % 60).toString().padStart(2, "0")}`;
export const makeId = () => Math.random().toString(36).slice(2);
export const setFtpTarget = (ftp: number, pct: number) => Math.round(ftp * pct / 100);
export const segmentDurationSeconds = (segment: Segment) => segment.minutes * 60 + (segment.seconds ?? 0);
export function buildSteps(w: Workout): Step[] {
  const steps: Step[] = [];
  let i = 0;

  const add = (s: Segment) =>
    steps.push({ ...s, index: ++i, total: 0 });

  if (segmentDurationSeconds(w.warmup) > 0) {
    add(w.warmup);
  }

  for (let n = 0; n < Math.max(1, w.reps); n++) {
    add({ ...w.work, label: `Work ${n + 1}` });

    if (
      n < w.reps - 1 &&
      segmentDurationSeconds(w.recovery) > 0
    ) {
      add(w.recovery);
    }
  }

  if (segmentDurationSeconds(w.cooldown) > 0) {
    add(w.cooldown);
  }

  return steps.map((s, idx, arr) => ({
    ...s,
    index: idx + 1,
    total: arr.length
  }));
}