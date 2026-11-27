import { useCallback, useEffect, useMemo, useState } from "react";
import { WorkoutTemplatesTile } from './tiles/WorkoutTemplatesTile';
import { WorkoutEditorTile } from './tiles/WorkoutEditorTile';
import { getWorkoutTemplates, WorkoutTemplateId } from './utils/workoutTemplates';
import { Workout, Mode, WorkoutType, TestType, Step } from './utils/types';
import { buildSteps, getTestSteps } from './utils/utils';
import { FtpTestTile } from './tiles/FtpTestTile';
import { ConnectTrainerPopUp } from './tiles/ConnectTrainerPopUp';
import { CurrentTrainingTile } from './tiles/CurrentTrainingTile';
import { useHeartRateMonitor } from './connections/useHeartRateMonitor';
import { useFtmsTrainer } from './connections/ftms/useFtmsTrainer';

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
  const { heartRate, heartRateConnected, heartRateMonitor } = useHeartRateMonitor();
  const [showConnectionDialog, setShowConnectionDialog] = useState(true);
  const [trainerConnected, setTrainerConnected] = useState(trainer.connected);
  const [ftpHistory, setFtpHistory] = useState<number[]>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem("ftpHistory") || "[]");
      return Array.isArray(stored) ? stored.filter((value): value is number => Number.isInteger(value) && value > 0 && value <= 2000) : [];
    } catch { return []; }
  });

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
  const [customSteps, setCustomSteps] = useState<Step[]>([]);
  const [testKind, setTestKind] = useState<TestType>(TestType.MIN_20);
  const [mode, setMode] = useState<Mode>("idle");

  const [longRideHours, setLongRideHours] = useState(() => Number(localStorage.getItem('z2LongRideHours') || 3));
  const templates = useMemo(() => getWorkoutTemplates(ftp, longRideHours * 60), [ftp, longRideHours]);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplateId>('over-under');
  const templateSteps = templates.find(template => template.id === selectedTemplate)?.steps;

  const trainingSteps = useMemo(() => {
    if (selectedWorkout === WorkoutType.INTERVAL) return buildSteps(workout);
    if (selectedWorkout === WorkoutType.CUSTOM) return customSteps;
    if (selectedWorkout === WorkoutType.TEMPLATE) return templateSteps;
    return getTestSteps(testKind, ftp);
  }, [customSteps, ftp, selectedWorkout, testKind, templateSteps, workout]);

  useEffect(() => {
    const unsubscribe = trainer.onConnectionChange(connected => {
      setTrainerConnected(connected);
      if (!connected) setShowConnectionDialog(true);
    });
    return unsubscribe;
  }, [trainer]);

  useEffect(() => {
    const unsubscribe = trainer.onData((data) => {
      if (data.power !== undefined) setPower(data.power);
      if (data.cadence !== undefined) setCadence(data.cadence);
    });
    return () => unsubscribe();
  }, [trainer]);

  useEffect(() => { localStorage.setItem("workout", JSON.stringify(workout)); }, [workout]);
  useEffect(() => { localStorage.setItem("ftp", String(ftp)); }, [ftp]);
  useEffect(() => { localStorage.setItem('z2LongRideHours', String(longRideHours)); }, [longRideHours]);
  useEffect(() => { localStorage.setItem("ftpHistory", JSON.stringify(ftpHistory)); }, [ftpHistory]);

  const startWorkout = useCallback((type: WorkoutType) => {
    setSelectedWorkout(type);
    setMode("running");
  }, []);

  return (
    <main className="shell">
      {showConnectionDialog ? (
        <ConnectTrainerPopUp
          trainer={trainer}
          heartRate={heartRate}
          heartRateConnected={heartRateConnected}
          heartRateMonitor={heartRateMonitor}
          onClose={() => setShowConnectionDialog(false)}
        />
      ) : null}
      <header className="topbar">
        <div><div className="eyebrow">INDOOR CYCLING · ERG CONTROL</div><h1>KICKR <span>INTERVAL COACH</span></h1></div>
        {trainerConnected ? (
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
          <WorkoutEditorTile connected={trainer.connected} onStart={steps => { setCustomSteps(steps); startWorkout(WorkoutType.CUSTOM); }} />
          <FtpTestTile runFtpTest={() => startWorkout(WorkoutType.TEST)} setTestKind={setTestKind} ftp={ftp} setFtp={setFtp} connected={trainer.connected} mode={mode} history={ftpHistory} setHistory={setFtpHistory} />
        </>
      ) : (
        <CurrentTrainingTile trainer={trainer} mode={mode} power={power} cadence={cadence} heartRate={heartRate} heartRateConnected={heartRateConnected} setMode={setMode} steps={trainingSteps} />
      )}
    </main>
  );
}