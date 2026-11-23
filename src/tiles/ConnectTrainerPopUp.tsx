import { useState } from 'react';
import { HeartRateMonitor } from '../connections/heartrate';
import { Trainer } from '../connections/ftms/shared';

export interface ConnectTrainerPopUpData {
  trainer: Trainer;
  heartRate: number | null;
  heartRateMonitor: HeartRateMonitor;
  onClose: () => void;
}

export const ConnectTrainerPopUp = ({
  trainer,
  heartRate,
  heartRateMonitor,
  onClose
}: ConnectTrainerPopUpData) => {
  const [trainerConnecting, setTrainerConnecting] = useState(false);
  const [heartRateConnecting, setHeartRateConnecting] = useState(false);
  const [error, setError] = useState('');

  async function connectTrainer() {
    setTrainerConnecting(true);
    setError('');
    try {
      await trainer.connect();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect to the trainer.');
    } finally {
      setTrainerConnecting(false);
    }
  }

  async function connectHeartRate() {
    setHeartRateConnecting(true);
    setError('');
    try {
      await heartRateMonitor.connect();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect to HeartCast.');
    } finally {
      setHeartRateConnecting(false);
    }
  }

  return (
    <div className="connect-dialog-overlay">
      <div className="connect-dialog-content">
        <div className="connection-section">
          <div className="eyebrow">REQUIRED</div>
          <h1 style={{ paddingBottom: "6px" }}>Trainer connection</h1>
          <span>{trainer.connected ? 'KICKR is connected and ready.' : "Connect your Wahoo KICKR CORE 2 to control resistance and receive cycling data."}</span>
          <div className="connection-row">
            <span className={`connection-status ${trainer.connected ? 'is-connected' : ''}`}>
              <i /> {trainer.connected ? 'KICKR connected' : 'Trainer not connected'}
            </span>
            {!trainer.connected ? (
              <button className="primary" onClick={() => connectTrainer()} disabled={trainerConnecting}>
                {trainerConnecting ? 'Connecting...' : 'Connect KICKR'}
              </button>
            ) : null}
          </div>
        </div>

        <div className="connection-divider" />

        <div className="connection-section">
          <div className="eyebrow">OPTIONAL</div>
          <h2>Heart-rate monitor</h2>
          <p>{heartRateMonitor.isMock ? 'Simulated heart-rate readings are enabled for development.' : 'Start HeartCast on your iPhone and Apple Watch, then connect it here to display live BPM during your ride.'}</p>
          <div className="connection-row">
            <span className={`connection-status ${heartRate !== null ? 'is-connected' : ''}`}>
              <i /> {heartRate !== null ? `${heartRateMonitor.name} · ${heartRate} BPM` : 'No heart-rate monitor connected'}
            </span>
            <div className="connection-buttons">
              {heartRate !== null ? (
                <button className="secondary" onClick={() => heartRateMonitor.disconnect()}>Disconnect</button>
              ) : (
                <button className="secondary" onClick={() => void connectHeartRate()} disabled={heartRateConnecting}>
                  {heartRateConnecting ? 'Connecting...' : heartRateMonitor.isMock ? 'Connect mock HR' : 'Connect HeartCast'}
                </button>
              )}
            </div>
          </div>
          <small className="connection-hint">You can skip this and connect it later. Trainer connection is required; heart rate is not.</small>
        </div>

        {error ? <p className="connection-error" role="alert">{error}</p> : null}

        <div className="connection-footer">
          <button className="primary" onClick={onClose} disabled={!trainer.connected}>Continue</button>
        </div>
      </div>
    </div>
  );
};
