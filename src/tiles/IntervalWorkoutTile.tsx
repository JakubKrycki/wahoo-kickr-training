import { Mode, Workout } from '../utils/types';
import { fmt, buildSteps, setFtpTarget } from '../utils/utils';

export interface IntervalWorkoutTileData {
  workout: Workout;
  setWorkout: React.Dispatch<React.SetStateAction<Workout>>
  ftp: number;
  connected: boolean;
  mode: Mode;
  runWorkout: () => void;
}

export const IntervalWorkoutTile = ({ connected, ftp, mode, runWorkout, workout, setWorkout }: IntervalWorkoutTileData) => {

  const updateSegment = (
    key: "warmup" | "work" | "recovery" | "cooldown",
    field: "minutes" | "seconds" | "watts",
    value: number
  ) => {
    const max =
      field === "minutes" ? 240 :
        field === "seconds" ? 59 : 1800;

    const safeValue = Math.max(0, Math.min(max, Math.round(value)));

    setWorkout(w => ({
      ...w,
      [key]: {
        ...w[key],
        [field]: safeValue
      }
    }));
  };

  return (
    <section id="builder" className="section">
      <div className="section-title"><div><div className="eyebrow">DESIGN YOUR SESSION</div><h2>Workout builder</h2></div><div className="pill">AUTO-SAVED LOCALLY</div></div>
      <div className="panel builder">
        <label className="field wide">Workout name<input value={workout.name} onChange={e => setWorkout(w => ({ ...w, name: e.target.value }))} /></label>
        <div className="segment-grid">
          {([
            ["warmup", "Warm-up", "Start easy and build into the session."],
            ["work", "Work interval", "Your hard effort."],
            ["recovery", "Recovery", "Easy spinning between efforts."],
            ["cooldown", "Cool-down", "Bring the effort down gradually."]
          ] as const).map(([key, title, hint]) => <div className="segment" key={key}>
            <div className="segment-title"><span>{title}</span><small>{hint}</small></div>
            <div className="inputs">
              <label>
                Minutes
                <input
                  type="number"
                  min="0"
                  max="240"
                  step="1"
                  value={workout[key].minutes}
                  onChange={e =>
                    updateSegment(key, "minutes", Number(e.target.value))
                  }
                />
              </label>

              <label>
                Seconds
                <input
                  type="number"
                  min="0"
                  max="59"
                  step="1"
                  value={workout[key].seconds ?? 0}
                  onChange={e =>
                    updateSegment(key, "seconds", Number(e.target.value))
                  }
                />
              </label>

              <label>
                Power · W
                <input
                  type="number"
                  min="0"
                  max="1800"
                  step="1"
                  value={workout[key].watts}
                  onChange={e =>
                    updateSegment(key, "watts", Number(e.target.value))
                  }
                />
              </label>
            </div>
            <button className="text-button" onClick={() => updateSegment(key, "watts", setFtpTarget(ftp, key === "work" ? 100 : key === "recovery" ? 55 : key === "warmup" ? 60 : 45))}>Use {key === "work" ? "100%" : key === "recovery" ? "55%" : key === "warmup" ? "60%" : "45%"} FTP</button>
          </div>)}
        </div>
        <div className="reps-row"><div><b>Repeat work + recovery</b><small>Number of hard efforts in this workout</small></div><div className="stepper"><button onClick={() => setWorkout(w => ({ ...w, reps: Math.max(1, w.reps - 1) }))}>−</button><strong>{workout.reps}</strong><button onClick={() => setWorkout(w => ({ ...w, reps: Math.min(30, w.reps + 1) }))}>+</button></div></div>
        <div className="builder-footer"><div><small>ESTIMATED DURATION</small><strong>{fmt(buildSteps(workout).reduce(
          (n, s) => n + s.minutes * 60 + (s.seconds ?? 0),
          0
        ))}</strong></div><button className="primary" disabled={!connected || mode === "running"} onClick={runWorkout}>Start workout <span>↗</span></button></div>
      </div>
    </section>
  );
}