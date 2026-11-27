import { SetStateAction, useEffect, useRef, useState } from 'react';
import { Mode, Step } from '../utils/types';
import { fmt, segmentDurationSeconds } from '../utils/utils';
import { Trainer } from '../connections/ftms/shared';
import { ShortcutsTile } from './ShortcutsTile';

export interface CurrentTrainingTileData {
  trainer: Trainer;
  mode: Mode;
  power: number | null;
  cadence: number | null;
  heartRate: number | null;
  heartRateConnected: boolean;
  setMode: React.Dispatch<SetStateAction<Mode>>;
  steps: Step[] | undefined;
}

export const CurrentTrainingTile = ({ trainer, mode, setMode, power, cadence, heartRate, heartRateConnected, steps }: CurrentTrainingTileData) => {
  const [remaining, setRemaining] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [commandError, setCommandError] = useState<string | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const stepsRef = useRef<Step[]>([]);
  const stepIndexRef = useRef(0);
  const remainingRef = useRef(0);
  const startedRef = useRef(false);
  const stepListRef = useRef<HTMLOListElement>(null);

  const current = mode === "finished" ? undefined : stepsRef.current[stepIndex] ?? steps?.[stepIndex];
  const totalSeconds = steps?.reduce((sum, s) => sum + segmentDurationSeconds(s), 0) ?? 0;
  const workoutRemaining = Math.max(0, totalSeconds - elapsed);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    const list = stepListRef.current;
    const activeStep = list?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!list || !activeStep) return;

    const targetScrollTop = activeStep.offsetTop - list.offsetTop - (list.clientHeight - activeStep.offsetHeight) / 2;
    list.scrollTo({ top: Math.max(0, Math.min(targetScrollTop, list.scrollHeight - list.clientHeight)), behavior: "smooth" });
  }, [stepIndex, mode, remaining]);

  async function sendTarget(watts: number) {
    await trainer.setTargetPower(watts);
  }
  async function beginSteps(nextSteps: Step[]) {
    if (!nextSteps.length) return;

    stepsRef.current = nextSteps;
    stepIndexRef.current = 0;
    remainingRef.current = segmentDurationSeconds(nextSteps[0]);
    setStepIndex(0);
    setElapsed(0);
    setRemaining(remainingRef.current);
    try {
      await trainer.startOrResume();
      await sendTarget(nextSteps[0].watts);
      setMode("running");
      startWorkoutTimer();
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : "Could not start the workout.");
      setMode("paused");
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

    // If paused, the new target will be sent when resuming.
    if (mode === "running") {
      void trainer.setTargetPower(nextWatts).catch(error => {
        setCommandError(error instanceof Error ? error.message : "Could not update target power.");
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = undefined;
        setMode("paused");
      });
    }
  }

  function skipCurrentStep() {
    if (mode !== "running") return;

    const nextIndex = stepIndexRef.current + 1;

    if (nextIndex >= stepsRef.current.length) return;

    const next = stepsRef.current[nextIndex];

    const skippedSeconds = remainingRef.current;
    setElapsed(value => value + skippedSeconds);
    stepIndexRef.current = nextIndex;
    remainingRef.current = segmentDurationSeconds(next);
    setStepIndex(nextIndex);
    setRemaining(remainingRef.current);

    void sendTarget(next.watts).catch(error => {
      setCommandError(error instanceof Error ? error.message : "Could not update trainer target.");
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = undefined;
      setMode("paused");
    });
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
        setCommandError(err instanceof Error ? err.message : "Could not advance trainer target.");
      });
    }, 1000);
  }

  async function pause() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = undefined;
    try {
      await trainer.pause();
      setMode("paused");
      setCommandError(null);
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : "Could not pause the trainer.");
      startWorkoutTimer();
    }
  }
  async function resume() {
    if (!steps?.length || mode !== "paused") return;
    try {
      await trainer.startOrResume();
      await sendTarget(stepsRef.current[stepIndexRef.current].watts);
      setMode("running");
      setCommandError(null);
      startWorkoutTimer();
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : "Could not resume the trainer.");
    }
  }
  async function stop() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = undefined;
    let stopError: string | null = null;
    try {
      await trainer.stop();
    } catch (error) {
      stopError = error instanceof Error ? error.message : "Could not stop the trainer.";
    }
    if (stopError) {
      setMode("paused");
      setCommandError(stopError);
      return;
    }
    remainingRef.current = 0;
    stepIndexRef.current = 0;
    stepsRef.current = [];
    setStepIndex(0);
    setElapsed(0);
    setRemaining(0);
    setMode("idle");
    setCommandError(null);
    startedRef.current = false;
  }

  useEffect(() => {
    return trainer.onConnectionChange(connected => {
      if (!connected && mode === "running") {
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = undefined;
        setMode("paused");
        setCommandError("Trainer disconnected. Reconnect it before resuming the workout.");
      }
    });
  }, [trainer, mode, setMode]);

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
      {commandError ? <p className="connection-error" role="alert">{commandError}</p> : null}
      <div className="live-session-layout">
        <aside className="workout-step-sidebar" aria-label="Workout steps">
          <div className="workout-step-sidebar-heading">
            <span className="eyebrow">WORKOUT PLAN</span>
            <strong>{stepsRef.current.length} STEPS</strong>
          </div>
          <ol className="workout-step-list" ref={stepListRef}>
            {stepsRef.current.map((step, index) => {
              const isPast = mode === "finished" || index < stepIndex;
              const isCurrent = mode !== "finished" && index === stepIndex;
              return (
                <li key={step.id + "-" + index} className={`workout-step-item ${isPast ? "is-past" : isCurrent ? "is-current" : "is-upcoming"}`} aria-current={isCurrent ? "step" : undefined}>
                  <span className="workout-step-number">{isPast ? "✓" : index + 1}</span>
                  <span className="workout-step-details">
                    <strong>{step.label}</strong>
                    <span>{fmt(segmentDurationSeconds(step))} <i>·</i> {step.watts} W</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </aside>
        <div className="live-session-main">
      <div className="panel current-step-card">
        <div className="current-step-heading">
          <span className="eyebrow">CURRENT STEP</span>
          <span className="current-step-number">{current ? `STEP ${current.index} OF ${current.total}` : "NO ACTIVE STEP"}</span>
        </div>
        <div className="current-step-details">
          <div className="current-step-name">{current?.label ?? (mode === "finished" ? "Workout complete" : "Ready when you are")}</div>
          <div className="current-step-metric">
            <small>TIME REMAINING</small>
            <strong>{mode === "finished" ? "00:00" : current ? fmt(remaining) : "—:—"}</strong>
          </div>
          <div className="current-step-metric">
            <small>TARGET POWER</small>
            <strong>{current?.watts ?? "—"}<i>{current ? " W" : ""}</i></strong>
          </div>
        </div>
      </div>
      <div className="panel session">
        <div className="session-main">
          <div className="workout-remaining">
            <span>WORKOUT REMAINING</span>
            <strong>{mode === "finished" ? "00:00" : current ? fmt(workoutRemaining) : "—:—"}</strong>
          </div>
        </div>

        <div className={`session-target${heartRateConnected ? " has-heart-rate" : ""}`}>
          <div className="metric">
            <small><span className="metric-icon">⚡</span> CURRENT POWER</small>
            <strong>
              {power ?? "—"}
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
          {heartRateConnected ? (
            <div className="metric">
              <small><span className="metric-icon heart-pulse">♥</span> HEART RATE</small>
              <strong>
                {heartRate ?? "—"}
                <i>BPM</i>
              </strong>
            </div>
          ) : null}
        </div>

        <div className="progress-track"><div style={{ width: `${totalSeconds ? Math.min(100, elapsed / totalSeconds * 100) : 0}%` }} /></div>
        <div className="session-actions">{mode === "running" ? <button className="secondary" onClick={() => void pause()}>Pause</button> : <button className="primary" onClick={() => void resume()}>Resume</button>}<button className="stop" disabled={mode === "idle"} onClick={() => void stop()}>Stop session</button></div>
      </div>
      <ShortcutsTile />
        </div>
      </div>
    </section>
  );
}