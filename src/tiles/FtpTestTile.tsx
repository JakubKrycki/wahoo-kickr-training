import { useState } from 'react';
import { Mode } from '../utils/types';

export interface FtpTestTileData {
  runFtpTest: () => void;
  setTestKind: React.Dispatch<React.SetStateAction<"20min" | "ramp">>;
  ftp: number;
  setFtp: React.Dispatch<React.SetStateAction<number>>;
  setStatus: React.Dispatch<React.SetStateAction<string>>;
  connected: boolean;
  mode: Mode;
}

export const FtpTestTile = ({ connected, mode, runFtpTest, ftp, setFtp, setStatus, setTestKind }: FtpTestTileData) => {
  const [testAverage, setTestAverage] = useState("");
  const [testFinalMinute, setTestFinalMinute] = useState("");


  const [history, setHistory] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem("ftpHistory") || "[]"); } catch { return []; }
  });

  function save20MinResult() {
    const avg = Number(testAverage);
    if (!Number.isFinite(avg) || avg <= 0) return;
    const next = Math.round(avg * 0.95);
    setFtp(next); setHistory(h => [next, ...h]); setTestAverage("");
    setStatus(`FTP saved: ${next} W (95% of ${avg} W).`);
  }
  function saveRampResult() {
    const last = Number(testFinalMinute);
    if (!Number.isFinite(last) || last <= 0) return;
    const next = Math.round(last * 0.75);
    setFtp(next); setHistory(h => [next, ...h]); setTestFinalMinute("");
    setStatus(`FTP saved: ${next} W (75% of ${last} W).`);
  }

  return (
    <section id="ftp" className="section">
      <div className="section-title"><div><div className="eyebrow">MEASURE YOUR ENGINE</div><h2>FTP lab</h2></div><div className="ftp-big"><strong>{ftp}</strong><small>W CURRENT FTP</small></div></div>
      <div className="ftp-grid">
        <div className="panel test-card"><div className="eyebrow">PROTOCOL 01</div><h3>20-minute test</h3><p>Warm-up and preparation, followed by a 20-minute maximal, evenly paced effort. Estimate FTP as 95% of average test power.</p><button className="secondary" disabled title="Automated free-ride control is not yet validated for this trainer.">Manual test · enter result below</button>
          <div className="result-entry"><label>Average power during 20 min (W)<input type="number" value={testAverage} onChange={e => setTestAverage(e.target.value)} placeholder="e.g. 240" /></label><button onClick={save20MinResult}>Save FTP result</button></div>
        </div>
        <div className="panel test-card"><div className="eyebrow">PROTOCOL 02</div><h3>Ramp test</h3><p>ERG target rises each minute. Stop the session when you can no longer maintain the target. This starter protocol estimates FTP as 75% of the highest fully completed one-minute stage.</p><button className="secondary" disabled={!connected || mode === "running"} onClick={() => { setTestKind("ramp"); runFtpTest(); }}>Start ramp test ↗</button>
          <div className="result-entry"><label>Highest fully completed 1-min power (W)<input type="number" value={testFinalMinute} onChange={e => setTestFinalMinute(e.target.value)} placeholder="e.g. 320" /></label><button onClick={saveRampResult}>Save FTP result</button></div>
        </div>
      </div>
      <div className="panel history"><div><div className="eyebrow">YOUR BASELINE</div><h3>FTP history</h3></div><div className="history-list">{history.length ? history.map((v, i) => <span key={`${v}-${i}`}>{v} W</span>) : <small>No tests saved yet. Your results will appear here.</small>}</div></div>
    </section>
  );
}