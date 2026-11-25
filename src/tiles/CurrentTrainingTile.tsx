import { SetStateAction, useEffect, useRef, useState } from 'react';
import { Mode, Step } from '../utils/types';
import { fmt, segmentDurationSeconds } from '../utils/utils';
import { Trainer } from '../connections/ftms/shared';

export interface CurrentTrainingTileData {
  trainer: Trainer;
  mode: Mode;
  power: number | null;
  cadence: number | null;
  heartRate: number | null;
  setMode: React.Dispatch<SetStateAction<Mode>>;
  steps: Step[] | undefined;
}

export const CurrentTrainingTile = ({ trainer, mode, setMode, power, cadence, heartRate, steps }: CurrentTrainingTileData) => {
  const [remaining, setRemaining] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [target, setTarget] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const timerRef = useRef<number | undefined>(undefined);
  const stepsRef = useRef<Step[]>([]);
  const stepIndexRef = useRef(0);
  const remainingRef = useRef(0);
  const startedRef = useRef(false);

  const current = steps !== undefined ? steps[stepIndex] : undefined;
  const totalSeconds = steps?.reduce((sum, s) => sum + s.minutes * 60, 0) ?? 0;
  const workoutRemaining = Math.max(0, totalSeconds - elapsed);

  useEffect(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
    }
  }, []);

  async function sendTarget(watts: number) {
    setTarget(watts);
    await trainer.setTargetPower(watts);
  }
  async function beginSteps(nextSteps: Step[]) {
    if (!nextSteps.length) return;

    stepsRef.current = nextSteps;
    stepIndexRef.current = 0;
    remainingRef.current = segmentDurationSeconds(nextSteps[0]);
    // setSteps(nextSteps);
    setStepIndex(0);
    setElapsed(0);
    setRemaining(remainingRef.current);
    try {
      await trainer.startOrResume();
      await sendTarget(nextSteps[0].watts);
      setMode("running");
      startWorkoutTimer();
    } catch (e) {
      setMode("idle");
    }
  }

  useEffect(() => {
    if (
      mode === "running" &&
      steps?.length &&
      !startedRef.current
    ) {
      startedRef.current = true;
      void beginSteps(steps);
    }
  }, [mode, steps]);

  // Zwift Click V2 keyboard controls
  function adjustCurrentTarget(delta: number) {
    if (!current || (mode !== "running" && mode !== "paused")) return;

    const nextWatts = Math.max(
      0,
      Math.min(1800, current.watts + delta)
    );

    const nextSteps = stepsRef.current.map((step, index) =>
      index === stepIndexRef.current
        ? { ...step, watts: nextWatts }
        : step
    );

    stepsRef.current = nextSteps;
    // setSteps(nextSteps);
    setTarget(nextWatts);

    // If paused, the new target will be sent when resuming.
    if (mode === "running") {
      void trainer.setTargetPower(nextWatts);
    }
  }

  function skipCurrentStep() {
    if (mode !== "running") return;

    const nextIndex = stepIndexRef.current + 1;

    if (nextIndex >= stepsRef.current.length) return;

    const next = stepsRef.current[nextIndex];

    stepIndexRef.current = nextIndex;
    setStepIndex(nextIndex);
    setRemaining(segmentDurationSeconds(next));

    void sendTarget(next.watts);
  }

  function startWorkoutTimer() {
    if (timerRef.current) window.clearInterval(timerRef.current);

    timerRef.current = window.setInterval(() => {
      setElapsed(value => value + 1);

      if (remainingRef.current > 1) {
        remainingRef.current -= 1;
        setRemaining(remainingRef.current);
        return;
      }

      const nextIndex = stepIndexRef.current + 1;
      if (nextIndex >= stepsRef.current.length) {
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = undefined;
        remainingRef.current = 0;
        setRemaining(0);
        setMode("finished");
        return;
      }

      // Advance exactly once per timer tick. Do not put side effects inside
      // a React state updater: Strict Mode may invoke updater functions twice.
      stepIndexRef.current = nextIndex;
      const next = stepsRef.current[nextIndex];
      remainingRef.current = segmentDurationSeconds(next);
      setStepIndex(nextIndex);
      setRemaining(remainingRef.current);

      void sendTarget(next.watts).catch(err => {
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = undefined;
        setMode("paused");
      });
    }, 1000);
  }

  async function pause() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = undefined;
    try {
      await trainer.pause();
      setMode("paused");
    } catch (e) { }
  }
  async function resume() {
    if (!steps?.length || mode !== "paused") return;
    try {
      await trainer.startOrResume();
      await sendTarget(stepsRef.current[stepIndexRef.current].watts);
      setMode("running");
      startWorkoutTimer();
    } catch (e) { }
  }
  async function stop() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = undefined;
    try {
      await trainer.stop();
    } catch { }
    remainingRef.current = 0;
    stepIndexRef.current = 0;
    stepsRef.current = [];
    setStepIndex(0);
    setElapsed(0);
    setRemaining(0);
    setMode("idle");
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement | null;
      const tag = element?.tagName?.toLowerCase();

      // Don't intercept keys while editing form fields.
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        element?.isContentEditable
      ) {
        return;
      }

      if (event.repeat) return;

      if (event.key === "ArrowUp") {
        event.preventDefault();
        adjustCurrentTarget(5);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        adjustCurrentTarget(-5);
      } else if (event.code === "Space") {
        event.preventDefault();

        if (mode === "running") {
          void pause();
        } else if (mode === "paused") {
          void resume();
        }
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        skipCurrentStep();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  });

  return (
    <section id="session" className="section">
      <div className="section-title"><div><div className="eyebrow">FOCUS ON THE EFFORT</div><h2>Live session</h2></div><div className={`pill ${mode === "running" ? "active" : ""}`}>{mode.toUpperCase()}</div></div>
      <div className="panel session">
        <div className="session-main"><div className="session-phase">{current?.label ?? "READY WHEN YOU ARE"}</div><div className="countdown">{mode === "finished" ? "DONE" : current ? fmt(remaining) : "—:—"}</div><div className="session-sub">{current
          ? `STEP ${current.index} OF ${current.total} · ${fmt(segmentDurationSeconds(current))}`
          : "Start a workout"}</div><div className="workout-remaining"><span>⏱</span> WORKOUT REMAINING <strong>{mode === "finished" ? "00:00" : current ? fmt(workoutRemaining) : "—:—"}</strong></div></div>

        <div className="session-target">
          <div className="metric">
            <small><span className="metric-icon">⚡</span> CURRENT POWER</small>
            <strong>
              {power ?? "—"}
              <i>W</i>
            </strong>
          </div>
          <div className="metric">
            <small><span className="metric-icon">🎯</span> ERG TARGET</small>
            <strong>
              {(current?.watts ?? target) || "—"}
              <i>W</i>
            </strong>
          </div>
          <div className="metric">
            <small><span className="metric-icon">🚴</span> CADENCE</small>
            <strong>
              {cadence ?? "—"}
              <i>RPM</i>
            </strong>
          </div>
          <div className="metric">
            <small><span className="metric-icon heart-pulse">♥</span> HEART RATE</small>
            <strong>
              {heartRate ?? "—"}
              <i>BPM</i>
            </strong>
          </div>
        </div>

        <div className="progress-track"><div style={{ width: `${totalSeconds ? Math.min(100, elapsed / totalSeconds * 100) : 0}%` }} /></div>
        <div className="session-actions">{mode === "running" ? <button className="secondary" onClick={() => void pause()}>Pause</button> : <button className="primary" onClick={() => void resume()}>Resume</button>}<button className="stop" disabled={mode === "idle"} onClick={() => void stop()}>Stop session</button></div>
      </div>
    </section>
  );
}