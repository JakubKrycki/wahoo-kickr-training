import { SetStateAction, useState } from 'react';
import { FtmsTrainer } from '../connections/ftms';
import { HeartRateMonitor } from '../connections/heartrate';

export interface ConnectTrainerPopUpData {
  trainer: FtmsTrainer;
  setConnected: React.Dispatch<SetStateAction<boolean>>;
  trainerConnected: boolean;
  heartRate: number | null;
  heartRateMonitor: HeartRateMonitor;
  onClose: () => void;
}

export const ConnectTrainerPopUp = ({
  trainer,
  setConnected,
  trainerConnected,
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
      setConnected(true);
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
          <span>{trainerConnected ? 'KICKR is connected and ready.' : "Connect your Wahoo KICKR CORE 2 to control resistance and receive cycling data."}</span>
          <div className="connection-row">
            <span className={`connection-status ${trainerConnected ? 'is-connected' : ''}`}>
              <i /> {trainerConnected ? 'KICKR connected' : 'Trainer not connected'}
            </span>
            {!trainerConnected ? (
              <button className="primary" onClick={() => void connectTrainer()} disabled={trainerConnecting}>
                {trainerConnecting ? 'Connecting...' : 'Connect KICKR'}
              </button>
            ) : null}
          </div>
        </div>

        <div className="connection-divider" />

        <div className="connection-section">
          <div className="eyebrow">OPTIONAL</div>
          <h2>Heart-rate monitor</h2>
          <p>Start HeartCast on your iPhone and Apple Watch, then connect it here to display live BPM during your ride.</p>
          <div className="connection-row">
            <span className={`connection-status ${heartRate !== null ? 'is-connected' : ''}`}>
              <i /> {heartRate !== null ? `HeartCast connected · ${heartRate} BPM` : 'No heart-rate monitor connected'}
            </span>
            <div className="connection-buttons">
              {heartRate !== null ? (
                <button className="secondary" onClick={() => heartRateMonitor.disconnect()}>Disconnect</button>
              ) : (
                <button className="secondary" onClick={() => void connectHeartRate()} disabled={heartRateConnecting}>
                  {heartRateConnecting ? 'Connecting...' : 'Connect HeartCast'}
                </button>
              )}
            </div>
          </div>
          <small className="connection-hint">You can skip this and connect it later. Trainer connection is required; heart rate is not.</small>
        </div>

        {error ? <p className="connection-error" role="alert">{error}</p> : null}

        <div className="connection-footer">
          <button className="primary" onClick={onClose} disabled={!trainerConnected}>Continue</button>
        </div>
      </div>
    </div>
  );
};
