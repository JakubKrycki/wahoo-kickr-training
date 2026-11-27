export type Segment = {
  id: string;
  label: string;
  minutes: number;
  seconds?: number;
  watts: number;
};
export type Workout = { name: string; warmup: Segment; work: Segment; recovery: Segment; reps: number; cooldown: Segment };
export enum WorkoutType {
  INTERVAL = "interval",
  TEST = "test",
  TEMPLATE = "template",
  CUSTOM = "custom"
};
export type Step = Segment & { index: number; total: number };
export type Mode = "idle" | "running" | "paused" | "finished";
export enum TestType {
  MIN_20 = "20min",
  RAMP = "ramp"
};