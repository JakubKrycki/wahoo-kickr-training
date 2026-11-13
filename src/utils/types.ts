export type Segment = {
  id: string;
  label: string;
  minutes: number;
  seconds?: number;
  watts: number;
};
export type Workout = { name: string; warmup: Segment; work: Segment; recovery: Segment; reps: number; cooldown: Segment };
export type WorkoutType = "interval" | "test";
export type Step = Segment & { index: number; total: number };
export type Mode = "idle" | "running" | "paused" | "finished";