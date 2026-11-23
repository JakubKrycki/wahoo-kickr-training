import { HeartRateMonitor } from './heartrate';

/** Simulates a BLE heart-rate monitor for local development. */
export class MockHeartRateMonitor extends HeartRateMonitor {
  private timer?: ReturnType<typeof setInterval>;
  private _connected = false;
  private bpm = 118;
  private readonly callback: (bpm: number | null) => void;

  constructor(onHeartRate: (bpm: number | null) => void) {
    super(onHeartRate);
    this.callback = onHeartRate;
  }

  get connected() {
    return this._connected;
  }

  get name() {
    return 'Mock heart-rate monitor';
  }

  get isMock() {
    return true;
  }

  async connect(): Promise<string> {
    if (this._connected) return this.name;

    this._connected = true;
    this.bpm = 118;
    this.callback(this.bpm);
    this.timer = setInterval(() => this.generateReading(), 1000);

    return this.name;
  }

  private generateReading() {
    if (!this._connected) return;
    // Random walk with a gentle pull toward a plausible steady-state value.
    this.bpm += (122 - this.bpm) * 0.08 + (Math.random() - 0.5) * 4;
    this.bpm = Math.max(85, Math.min(175, this.bpm));
    this.callback(Math.round(this.bpm));
  }

  disconnect() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this._connected = false;
    this.callback(null);
  }

  dispose() {
    this.disconnect();
  }
}
