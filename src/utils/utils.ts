import { Workout, Step, Segment, TestType } from './types';

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

export function intervalSessionData(ftp: number) {
  const warm: Segment = { id: "testwarm", label: "Test warm-up", minutes: 10, watts: setFtpTarget(ftp, 55) };
    const prep: Segment = { id: "prep", label: "Preparation", minutes: 5, watts: setFtpTarget(ftp, 75) };
    const open: Segment = { id: "open", label: "Openers", minutes: 1, watts: setFtpTarget(ftp, 100) };
    const easy: Segment = { id: "easy", label: "Easy spin", minutes: 5, watts: setFtpTarget(ftp, 50) };
    const cooldown: Segment = { id: "cool", label: "Cool-down", minutes: 5, watts: setFtpTarget(ftp, 45) };
    return { warm, prep, open, easy, cooldown };
}

export function getTestSteps(testKind: TestType, ftp: number) {
  let { warm, prep, open, easy, cooldown } = intervalSessionData(ftp);
  let protocol: Segment[];
  if (testKind === TestType.MIN_20) {
    protocol = [warm, prep, open, easy,
      { id: "test20", label: "20-minute free ride", minutes: 20, watts: 0, control: "free" }, cooldown];
  } else {
    const ramp: Segment[] = Array.from({ length: 15 }, (_, i) => ({
      id: `ramp${i}`, label: `Ramp · ${i + 1} min`, minutes: 1,
      watts: Math.round(setFtpTarget(ftp, 50) + (i + 1) * 15)
    }));
    protocol = [warm, ...ramp, cooldown];
  }
  return protocol.map((segment, index) => ({ ...segment, index: index + 1, total: protocol.length }));
}