import { useCallback, useEffect, useMemo, useState } from "react";
import { IntervalWorkoutTile } from './tiles/IntervalWorkoutTile';
import { WorkoutTemplatesTile } from './tiles/WorkoutTemplatesTile';
import { getWorkoutTemplates, WorkoutTemplateId } from './utils/workoutTemplates';
import { Workout, Mode, WorkoutType, TestType } from './utils/types';
import { buildSteps, getTestSteps } from './utils/utils';
import { FtpTestTile } from './tiles/FtpTestTile';
import { ConnectTrainerPopUp } from './tiles/ConnectTrainerPopUp';
import { ShortcutsTile } from './tiles/ShortcutsTile';
import { CurrentTrainingTile } from './tiles/CurrentTrainingTile';
import { useHeartRateMonitor } from './connections/useHeartRateMonitor';
import { useFtmsTrainer } from './connections/ftms/useFtmsTrainer';
import type { Trainer } from './connections/ftms/shared';

const initial: Workout = {
  name: "5 × 4 min intervals",
  warmup: { id: "warmup", label: "Warm-up", minutes: 10, watts: 120 },
  work: { id: "work", label: "Work", minutes: 4, watts: 250 },
  recovery: { id: "recovery", label: "Recovery", minutes: 3, watts: 120 },
  reps: 5,
  cooldown: { id: "cooldown", label: "Cool-down", minutes: 5, watts: 100 }
};

export default function App() {
  const { trainer } = useFtmsTrainer();
  const { heartRate, heartRateMonitor } = useHeartRateMonitor();
  const [showConnectionDialog, setShowConnectionDialog] = useState(true);

  const handleConnect = async () => {
    await heartRateMonitor.connect();
  };

  const handleDisconnect = async () => {
    await heartRateMonitor.disconnect();
  };

  const [power, setPower] = useState<number | null>(null);
  const [cadence, setCadence] = useState<number | null>(null);
  const [ftp, setFtp] = useState(() => Number(localStorage.getItem("ftp") || 200));
  const [editingFtp, setEditingFtp] = useState(false);
  const [ftpDraft, setFtpDraft] = useState(String(ftp));
  const startEditingFtp = () => { setFtpDraft(String(ftp)); setEditingFtp(true); };
  const saveFtp = () => {
    const next = Number(ftpDraft);
    if (Number.isInteger(next) && next >= 1 && next <= 2000) { setFtp(next); setEditingFtp(false); }
  };
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutType>();
  const [workout, setWorkout] = useState<Workout>(() => JSON.parse(localStorage.getItem("workout") || "null") || initial);
  const [testKind, setTestKind] = useState<TestType>(TestType.MIN_20);
  const [mode, setMode] = useState<Mode>("idle");

  const [longRideHours, setLongRideHours] = useState(() => Number(localStorage.getItem('z2LongRideHours') || 3));
  const templates = useMemo(() => getWorkoutTemplates(ftp, longRideHours * 60), [ftp, longRideHours]);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplateId>('over-under');
  const templateSteps = templates.find(template => template.id === selectedTemplate)?.steps;

  const trainingSteps = useMemo(() => {
    if (selectedWorkout === WorkoutType.INTERVAL) return buildSteps(workout);
    if (selectedWorkout === WorkoutType.TEMPLATE) return templateSteps;
    return getTestSteps(testKind, ftp);
  }, [ftp, selectedWorkout, testKind, templateSteps, workout]);

  useEffect(() => {
    if (!trainer.connected) {
      setShowConnectionDialog(true);
    }
  }, []);

  //this could be moved to currentTrainingTile
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

  //this could be moved to interval training maybe, but probably there should be separate component for FtpTestTile and IntervalWorkoutTile
  useEffect(() => {
    localStorage.setItem("workout", JSON.stringify(workout));
  }, [workout]);

  useEffect(() => { localStorage.setItem("ftp", String(ftp)); }, [ftp]);
  useEffect(() => { localStorage.setItem('z2LongRideHours', String(longRideHours)); }, [longRideHours]);
  useEffect(() => { localStorage.setItem("ftpHistory", JSON.stringify(history)); }, [history]);

  const startWorkout = useCallback((workout: WorkoutType) => {
    setSelectedWorkout(workout);
    setMode("running");
  }, [setSelectedWorkout, setMode]);

  return (
    <main className="shell">
      {showConnectionDialog ? (
        <ConnectTrainerPopUp
          trainer={trainer}
          heartRate={heartRate}
          heartRateMonitor={heartRateMonitor}
          onClose={() => setShowConnectionDialog(false)}
        />
      ) : null}
      <header className="topbar">
        <div><div className="eyebrow">INDOOR CYCLING · ERG CONTROL</div><h1>KICKR <span>INTERVAL COACH</span></h1></div>
        {trainer.connected ? (
          <div className="header-controls">
            <div className="ftp-header-control">
              {editingFtp ? (
                <input aria-label="FTP in watts" className="ftp-header-input" type="number" min="1" max="2000"
                  value={ftpDraft} autoFocus onChange={event => setFtpDraft(event.target.value)} onBlur={saveFtp}
                  onKeyDown={event => {
                    if (event.key === "Enter") saveFtp();
                    if (event.key === "Escape") { setEditingFtp(false); setFtpDraft(String(ftp)); }
                  }} />
              ) : (
                <span className="ftp-header-value" title="Functional Threshold Power">{ftp} <small>FTP</small></span>
              )}
              {!editingFtp ? <button className="ftp-edit-button" aria-label="Edit FTP" title="Edit FTP" onClick={startEditingFtp}>✎</button> : null}
            </div>
            <button className="secondary" onClick={() => setShowConnectionDialog(true)}>Connections</button>
          </div>
        ) : null}
      </header>

      {mode === "idle" ? (
        <>
          <WorkoutTemplatesTile templates={templates} selected={selectedTemplate} onSelect={setSelectedTemplate} connected={trainer.connected} onStart={() => startWorkout(WorkoutType.TEMPLATE)} longRideHours={longRideHours} onLongRideHoursChange={setLongRideHours} />
          <IntervalWorkoutTile workout={workout} setWorkout={setWorkout} ftp={ftp} connected={trainer.connected} mode={mode} runWorkout={() => startWorkout(WorkoutType.INTERVAL)} />
          <FtpTestTile runFtpTest={() => startWorkout(WorkoutType.TEST)} setTestKind={setTestKind} ftp={ftp} setFtp={setFtp} connected={trainer.connected} mode={mode} />
        </>
      ) : (
        <>
          <CurrentTrainingTile trainer={trainer} mode={mode} power={power} cadence={cadence} heartRate={heartRate} setMode={setMode} steps={trainingSteps} />
          <ShortcutsTile />
        </>
      )
      }
      <footer><span>KICKR INTERVAL COACH · LOCAL-FIRST</span><span>Training data stays in this browser.</span></footer>
    </main >
  );
}