import { SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FtmsTrainer } from "./connections/ftms";
import { HeartRateMonitor } from "./connections/heartrate";
import { IntervalWorkoutTile } from './tiles/IntervalWorkoutTile';
import { Workout, Step, Segment, Mode, WorkoutType } from './utils/types';
import { buildSteps, fmt, setFtpTarget } from './utils/utils';
import { FtpTestTile } from './tiles/FtpTestTile';
import { ConnectTrainerPopUp } from './tiles/ConnectTrainerPopUp';
import { ShortcutsTile } from './tiles/ShortcutsTile';
import { CurrentTrainingTile } from './tiles/CurrentTrainingTile';

const initial: Workout = {
  name: "5 × 4 min intervals",
  warmup: { id: "warmup", label: "Warm-up", minutes: 10, watts: 120 },
  work: { id: "work", label: "Work", minutes: 4, watts: 250 },
  recovery: { id: "recovery", label: "Recovery", minutes: 3, watts: 120 },
  reps: 5,
  cooldown: { id: "cooldown", label: "Cool-down", minutes: 5, watts: 100 }
};

export default function App() {
  const trainer = useMemo(() => new FtmsTrainer(), []);
  const [connected, setConnected] = useState(false);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [showConnectionDialog, setShowConnectionDialog] = useState(true);
  const heartRateMonitor = useMemo(() => new HeartRateMonitor(setHeartRate), []);
  const [status, setStatus] = useState("Connect your trainer to begin.");
  const [power, setPower] = useState<number | null>(null);
  const [cadence, setCadence] = useState<number | null>(null);
  const [ftp, setFtp] = useState(() => Number(localStorage.getItem("ftp") || 200));
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutType>();
  const [workout, setWorkout] = useState<Workout>(() => {
    try { return JSON.parse(localStorage.getItem("workout") || "null") || initial; } catch { return initial; }
  });
  const [mode, setMode] = useState<Mode>("idle");

  const [testKind, setTestKind] = useState<"20min" | "ramp">("20min");

  const ftpTestSteps: Step[] = useMemo(() => {
    const warm: Segment = { id: "testwarm", label: "Test warm-up", minutes: 10, watts: setFtpTarget(ftp, 55) };
    const prep: Segment = { id: "prep", label: "Preparation", minutes: 5, watts: setFtpTarget(ftp, 75) };
    const open: Segment = { id: "open", label: "Openers", minutes: 1, watts: setFtpTarget(ftp, 100) };
    const easy: Segment = { id: "easy", label: "Easy spin", minutes: 5, watts: setFtpTarget(ftp, 50) };
    const cooldown: Segment = { id: "cool", label: "Cool-down", minutes: 5, watts: setFtpTarget(ftp, 45) };
    let protocol: Segment[];
    if (testKind === "20min") {
      protocol = [warm, prep, open, easy,
        { id: "test20", label: "20-minute maximal effort", minutes: 20, watts: setFtpTarget(ftp, 100) }, cooldown];
    } else {
      const ramp: Segment[] = Array.from({ length: 15 }, (_, i) => ({
        id: `ramp${i}`, label: `Ramp · ${i + 1} min`, minutes: 1,
        watts: Math.round(setFtpTarget(ftp, 50) + (i + 1) * 15)
      }));
      protocol = [warm, ...ramp, cooldown];
    }
    return protocol.map((segment, index) => ({ ...segment, index: index + 1, total: protocol.length }));
  }, [testKind, ftp]);

  const intervalSteps = useMemo(() => {
    return buildSteps(workout);
  }, [workout])

  useEffect(() => {
    const unsubscribe = trainer.onData((data) => {
      if (data.power !== undefined) {
        setPower(data.power);
      }

      if (data.cadence !== undefined) {
        setCadence(data.cadence);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [trainer]);

  useEffect(() => {
    localStorage.setItem("workout", JSON.stringify(workout));
  }, [workout]);
  useEffect(() => { localStorage.setItem("ftp", String(ftp)); }, [ftp]);
  useEffect(() => { localStorage.setItem("ftpHistory", JSON.stringify(history)); }, [history]);

  const startWorkout = useCallback((workout: WorkoutType) => {
    setSelectedWorkout(workout);
    setMode("running");
  }, [setSelectedWorkout, setMode]);

  return (
    <main className="shell">
      {showConnectionDialog || !connected ? (
        <ConnectTrainerPopUp
          trainer={trainer}
          setConnected={setConnected}
          trainerConnected={connected}
          heartRate={heartRate}
          heartRateMonitor={heartRateMonitor}
          onClose={() => setShowConnectionDialog(false)}
        />
      ) : null}
      <header className="topbar">
        <div><div className="eyebrow">INDOOR CYCLING · ERG CONTROL</div><h1>KICKR <span>INTERVAL COACH</span></h1></div>
        {connected ? <button className="secondary" onClick={() => setShowConnectionDialog(true)}>Connections</button> : null}
      </header>
      {/* <section className="hero panel">
        <div className="hero-copy"><div className="eyebrow">YOUR TRAINING, YOUR RULES</div><h2>Ride the plan.<br /><em>Not the buttons.</em></h2><p>Build structured sessions, let ERG handle the resistance, and track your FTP over time.</p>
          <small className="status">{status}</small>
        </div>
        <div className="live-card">
          <div className="live-head"><span>LIVE TELEMETRY</span><span className={connected ? "dot live" : "dot"} /></div>
          <div className="live-stats"><div><b>{cadence ?? "—"}</b><small>RPM</small></div><div><b>{target || "—"}</b><small>ERG TARGET</small></div><div><b>{ftp}</b><small>FTP W</small></div></div>
        </div>
      </section> */}

      <ShortcutsTile />

      {mode === "idle" ? (
        <>
          <IntervalWorkoutTile workout={workout} setWorkout={setWorkout} ftp={ftp} connected={connected} mode={mode} runWorkout={() => startWorkout("interval")} />
          <FtpTestTile runFtpTest={() => startWorkout("test")} setTestKind={setTestKind} ftp={ftp} setFtp={setFtp} setStatus={setStatus} connected={connected} mode={mode} />
        </>
      ) : <CurrentTrainingTile trainer={trainer} mode={mode} power={power} cadence={cadence} heartRate={heartRate} setMode={setMode} steps={selectedWorkout === "interval" ? intervalSteps : (selectedWorkout === "test" ? ftpTestSteps : undefined)} />
      }
      <footer><span>KICKR INTERVAL COACH · LOCAL-FIRST</span><span>Training data stays in this browser.</span></footer>
    </main >
  );
}