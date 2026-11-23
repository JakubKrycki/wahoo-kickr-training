import { WorkoutTemplate, WorkoutTemplateId } from '../utils/workoutTemplates';
import { fmt } from '../utils/utils';

interface WorkoutTemplatesTileProps {
  templates: WorkoutTemplate[];
  selected: WorkoutTemplateId;
  onSelect: (id: WorkoutTemplateId) => void;
  connected: boolean;
  onStart: () => void;
}

export function WorkoutTemplatesTile({ templates, selected, onSelect, connected, onStart }: WorkoutTemplatesTileProps) {
  const active = templates.find(template => template.id === selected) ?? templates[0];
  return (
    <section className="section">
      <div className="section-title">
        <div><div className="eyebrow">READY-MADE SESSIONS</div><h2>Workout templates</h2></div>
        <div className="pill">FTP-BASED TARGETS</div>
      </div>
      <div className="panel builder">
        <div className="template-grid">
          {templates.map(template => (
            <button key={template.id} className={`template-card ${selected === template.id ? 'selected' : ''}`} onClick={() => onSelect(template.id)}>
              <span className="template-duration">{fmt(template.durationMinutes * 60)}</span>
              <strong>{template.name}</strong>
              <span>{template.description}</span>
            </button>
          ))}
        </div>
        <div className="template-preview">
          <div><small>SELECTED SESSION</small><h3>{active.name}</h3><p>{active.description}</p></div>
          <div className="template-steps">
            {active.steps.map((step, index) => <div key={step.id} className="template-step">
              <span>{index + 1}. {step.label}</span><strong>{step.minutes} min · {step.watts} W</strong>
            </div>)}
          </div>
          <div className="builder-footer">
            <div><small>SESSION LENGTH</small><strong>{fmt(active.durationMinutes * 60)}</strong></div>
            <button className="primary" disabled={!connected} onClick={onStart}>Start {active.name} <span>↗</span></button>
          </div>
          {!connected ? <span className="status">Connect your trainer to start a template.</span> : null}
        </div>
      </div>
    </section>
  );
}
