import { useMemo, useState } from "react";
import { Segment, Step } from "../utils/types";
import "./WorkoutEditorTile.css";
import { fmt, makeId, segmentDurationSeconds } from "../utils/utils";

type RepeatBlock = { type: "repeat"; id: string; steps: Segment[]; repetitions: number };
type WorkoutPart = Segment | RepeatBlock;
type Definition = { id: string; name: string; parts: WorkoutPart[] };
const isRepeat = (part: WorkoutPart): part is RepeatBlock => "type" in part && part.type === "repeat";
const duration = (part: Segment) => Math.max(0, Math.min(14400, part.minutes * 60 + (part.seconds ?? 0)));
const initial: Definition = {
  id: "starter", name: "Custom intervals", parts: [
    { id: makeId(), label: "Warm-up", minutes: 10, seconds: 0, watts: 110 },
    { id: makeId(), type: "repeat", repetitions: 4, steps: [
      { id: makeId(), label: "Work", minutes: 3, seconds: 0, watts: 240 },
      { id: makeId(), label: "Recovery", minutes: 2, seconds: 0, watts: 110 }
    ] },
    { id: makeId(), label: "Cool-down", minutes: 5, seconds: 0, watts: 90 }
  ]
};
function expand(parts: WorkoutPart[]): Step[] {
  const segments: Segment[] = [];
  const append = (part: WorkoutPart) => {
    if (isRepeat(part)) {
      for (let n = 0; n < part.repetitions; n++) part.steps.forEach(step => segments.push({ ...step, id: `${step.id}-${n + 1}`, label: `${step.label} · ${n + 1}/${part.repetitions}` }));
    } else segments.push(part);
  };
  parts.forEach(append);
  return segments.map((step, index) => ({ ...step, index: index + 1, total: segments.length }));
}
function secondsLabel(value: number) { return fmt(value); }

function PowerChart({ steps }: { steps: Step[] }) {
  const points = useMemo(() => {
    let elapsed = 0;
    return steps.map(step => {
      const start = elapsed; elapsed += segmentDurationSeconds(step);
      return { start, end: elapsed, watts: step.watts, label: step.label };
    }).filter(p => p.end > p.start);
  }, [steps]);
  const total = points.at(-1)?.end ?? 0;
  const maxPower = Math.max(100, Math.ceil((Math.max(...points.map(p => p.watts), 100) * 1.15) / 50) * 50);
  const width = 760, height = 260, left = 54, right = 18, top = 14, bottom = 38;
  const plotW = width - left - right, plotH = height - top - bottom;
  const x = (t: number) => left + (total ? t / total : 0) * plotW;
  const y = (w: number) => top + plotH - (w / maxPower) * plotH;
  const ticks = Array.from({ length: 5 }, (_, i) => Math.round(maxPower * i / 4));
  const path = points.length ? points.map((p, i) => `${i ? "L" : "M"} ${x(p.start)} ${y(p.watts)} L ${x(p.end)} ${y(p.watts)}`).join(" ") : "";
  return <div className="workout-chart-wrap">
    <div className="workout-chart-title"><strong>POWER PROFILE</strong><span>{secondsLabel(total)} total</span></div>
    <svg className="workout-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Workout power over time chart">
      {ticks.map(tick => <g key={tick}><line x1={left} x2={width-right} y1={y(tick)} y2={y(tick)} className="chart-gridline" /><text x={left-9} y={y(tick)+4} textAnchor="end" className="chart-label">{tick}</text></g>)}
      <line x1={left} x2={left} y1={top} y2={height-bottom} className="chart-axis" />
      <line x1={left} x2={width-right} y1={height-bottom} y2={height-bottom} className="chart-axis" />
      {points.map((p,i) => <rect key={i} x={x(p.start)} y={y(p.watts)} width={Math.max(1,x(p.end)-x(p.start))} height={height-bottom-y(p.watts)} className={i%2 ? "chart-step-alt" : "chart-step"} opacity=".12" />)}
      {path && <path d={path} className="chart-line" />}
      <text x={left} y={height-9} className="chart-label">0:00</text>
      <text x={width-right} y={height-9} textAnchor="end" className="chart-label">{secondsLabel(total)}</text>
      <text x={left+plotW/2} y={height-9} textAnchor="middle" className="chart-axis-title">TIME</text>
      <text x={14} y={top+plotH/2} textAnchor="middle" transform={`rotate(-90 14 ${top+plotH/2})`} className="chart-axis-title">POWER · W</text>
    </svg>
  </div>;
}

export function WorkoutEditorTile({ connected, onStart }: { connected: boolean; onStart: (steps: Step[]) => void }) {
  const [workouts, setWorkouts] = useState<Definition[]>(() => {
    try { const saved = JSON.parse(localStorage.getItem("customWorkouts") || "[]"); return Array.isArray(saved) && saved.length ? saved : [initial]; }
    catch { return [initial]; }
  });
  const [activeId, setActiveId] = useState(workouts[0]?.id ?? initial.id);
  const [name, setName] = useState(workouts[0]?.name ?? initial.name);
  const [parts, setParts] = useState<WorkoutPart[]>(workouts[0]?.parts ?? initial.parts);
  const [selected, setSelected] = useState<number[]>([]);
  const [repetitions, setRepetitions] = useState(3);
  const steps = useMemo(() => expand(parts), [parts]);
  const total = steps.reduce((sum, step) => sum + segmentDurationSeconds(step), 0);
  const updateParts = (next: WorkoutPart[]) => setParts(next);
  const updateSegment = (index: number, patch: Partial<Segment>) => updateParts(parts.map((part,i) => i === index && !isRepeat(part) ? { ...part, ...patch } : part));
  const loadWorkout = (id: string) => {
    const found = workouts.find(w => w.id === id); if (!found) return;
    setActiveId(found.id); setName(found.name); setParts(found.parts); setSelected([]);
  };
  const save = () => {
    const cleanName = name.trim() || "Untitled workout";
    const next = { id: activeId, name: cleanName, parts };
    const saved = [...workouts.filter(w => w.id !== activeId), next];
    setWorkouts(saved); localStorage.setItem("customWorkouts", JSON.stringify(saved)); setName(cleanName);
  };
  const create = () => {
    const fresh = { id: makeId(), name: "New workout", parts: [{ id: makeId(), label: "New step", minutes: 2, seconds: 0, watts: 100 }] as WorkoutPart[] };
    setActiveId(fresh.id); setName(fresh.name); setParts(fresh.parts); setSelected([]);
  };
  const addStep = () => updateParts([...parts, { id: makeId(), label: "New step", minutes: 2, seconds: 0, watts: 100 }]);
  const removePart = (index: number) => updateParts(parts.filter((_,i) => i !== index));
  const movePart = (index: number, direction: number) => {
    const target = index + direction; if (target < 0 || target >= parts.length) return;
    const next = [...parts]; [next[index],next[target]] = [next[target],next[index]]; updateParts(next);
  };
  const groupSelected = () => {
    if (selected.length < 1) return;
    const sorted = [...selected].sort((a,b) => a-b);
    if (sorted.some((value,i) => i > 0 && value !== sorted[i-1]+1)) return;
    const first = sorted[0], last = sorted[sorted.length-1];
    if (parts.slice(first,last+1).some(isRepeat)) return;
    const group: RepeatBlock = { type: "repeat", id: makeId(), steps: parts.slice(first,last+1) as Segment[], repetitions };
    updateParts([...parts.slice(0,first), group, ...parts.slice(last+1)]); setSelected([]);
  };
  const ungroup = (index: number) => { const part = parts[index]; if (isRepeat(part)) updateParts([...parts.slice(0,index), ...part.steps, ...parts.slice(index+1)]); };
  return <section className="section">
    <div className="section-title"><div><div className="eyebrow">BUILD YOUR OWN SESSION</div><h2>Workout editor</h2></div><div className="pill">SAVED LOCALLY</div></div>
    <div className="panel builder workout-editor">
      <div className="workout-editor-toolbar">
        <label className="field wide">Saved workouts<select value={workouts.some(w=>w.id===activeId)?activeId:""} onChange={e=>loadWorkout(e.target.value)}>{workouts.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        <button className="secondary" onClick={create}>New workout</button>
      </div>
      <label className="field wide">Workout name<input value={name} onChange={e=>setName(e.target.value)} /></label>
      <div className="workout-editor-steps">
        {parts.map((part,index) => isRepeat(part) ? <div className="editor-repeat" key={part.id}>
          <div className="editor-repeat-heading"><strong>REPEAT BLOCK</strong><span>{part.repetitions} repetitions</span><button className="text-button" onClick={()=>ungroup(index)}>Ungroup</button><button className="icon-button" aria-label="Remove repeat block" onClick={()=>removePart(index)}>×</button></div>
          {part.steps.map((step,i)=><div className="repeat-step-preview" key={step.id}>{i+1}. {step.label} · {duration(step)} sec · {step.watts} W</div>)}
        </div> : <div className="editor-step" key={part.id}>
          <label className="select-step"><input type="checkbox" checked={selected.includes(index)} onChange={e=>setSelected(current=>e.target.checked?[...current,index]:current.filter(n=>n!==index))} aria-label={`Select ${part.label} for repetition`} /></label>
          <div className="editor-step-fields">
            <label>Step name<input value={part.label} onChange={e=>updateSegment(index,{label:e.target.value})}/></label>
            <label>Minutes<input type="number" min="0" max="240" value={part.minutes} onChange={e=>updateSegment(index,{minutes:Math.max(0,Math.min(240,Number(e.target.value)||0))})}/></label>
            <label>Seconds<input type="number" min="0" max="59" value={part.seconds??0} onChange={e=>updateSegment(index,{seconds:Math.max(0,Math.min(59,Number(e.target.value)||0))})}/></label>
            <label>Power · W<input type="number" min="0" max="1800" value={part.watts} onChange={e=>updateSegment(index,{watts:Math.max(0,Math.min(1800,Number(e.target.value)||0))})}/></label>
          </div>
          <div className="editor-step-actions"><button className="icon-button" aria-label="Move step up" onClick={()=>movePart(index,-1)}>↑</button><button className="icon-button" aria-label="Move step down" onClick={()=>movePart(index,1)}>↓</button><button className="icon-button" aria-label="Remove step" onClick={()=>removePart(index)}>×</button></div>
        </div>)}
      </div>
      <div className="editor-actions">
        <button className="secondary" onClick={addStep}>+ Add step</button>
        <div className="repeat-controls"><label>Repeat selected steps <input type="number" min="2" max="30" value={repetitions} onChange={e=>setRepetitions(Math.max(2,Math.min(30,Number(e.target.value)||2)))}/></label><button className="secondary" disabled={!selected.length || selected.length!==Math.max(...selected)-Math.min(...selected)+1} onClick={groupSelected}>Create repeat block</button></div>
      </div>
      <PowerChart steps={steps}/>
      <div className="builder-footer"><div><small>ESTIMATED DURATION</small><strong>{fmt(total)}</strong><small>{steps.length} workout steps after repetitions</small></div><div className="editor-save-actions"><button className="secondary" onClick={save}>Save workout</button><button className="primary" disabled={!connected || !steps.length || total===0} onClick={()=>{save();onStart(steps);}}>Start workout ↗</button></div></div>
    </div>
  </section>;
}
