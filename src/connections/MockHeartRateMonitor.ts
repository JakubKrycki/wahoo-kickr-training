import { HeartRateData, HeartRateListener, HeartRateMonitor } from './ftms/shared';

/** Simulates a BLE heart-rate monitor for local development. */
export class MockHeartRateMonitor implements HeartRateMonitor {
  private listeners = new Set<HeartRateListener>();
  private connectionListeners = new Set<(connected: boolean) => void>();
  private timer?: ReturnType<typeof setInterval>;
  private _connected = false;
  private bpm = 118;

  get connected() {
    return this._connected;
  }

  get isMock() {
    return true;
  }

  onConnectionChange(listener: (connected: boolean) => void) {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  onData(listener: HeartRateListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async connect(): Promise<void> {
    if (this._connected) return;

    this._connected = true;
    this.connectionListeners.forEach(listener => listener(true));
    this.bpm = 118;
    this.publish({ heartRate: this.bpm });
    this.timer = setInterval(() => this.generateReading(), 1000);
  }

  private publish(data: HeartRateData) {
    this.listeners.forEach(listener => listener(data));
  }

  private generateReading() {
    if (!this._connected) return;

    // Random walk with a gentle pull toward a plausible steady-state value.
    this.bpm += (122 - this.bpm) * 0.08 + (Math.random() - 0.5) * 4;
    this.bpm = Math.max(85, Math.min(175, this.bpm));
    this.publish({ heartRate: Math.round(this.bpm) });
  }

  disconnect() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    this._connected = false;
    this.publish({});
    this.connectionListeners.forEach(listener => listener(false));
  }

  dispose() {
    this.disconnect();
    this.listeners.clear();
  }
}
