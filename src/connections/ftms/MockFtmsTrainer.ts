import { BikeData, Listener, Trainer } from './shared';

export class MockFtmsTrainer implements Trainer {
  private listeners = new Set<Listener>();
  private connectionListeners = new Set<(connected: boolean) => void>();

  private timer?: ReturnType<typeof setInterval>;

  private _connected = false;

  private targetPower = 150;
  private power = 150;
  private cadence = 85;

  get connected(): boolean {
    return this._connected;
  }

  async connect() {
    if (this._connected) {
      return;
    }

    this._connected = true;
    this.connectionListeners.forEach(listener => listener(true));

    this.timer = setInterval(() => {
      this.generateData();
    }, 1000);

    this.generateData();
  }

  onConnectionChange(listener: (connected: boolean) => void): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  onData(listener: Listener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  async setTargetPower(watts: number): Promise<void> {
    if (!Number.isFinite(watts)) {
      throw new Error("Invalid power target.");
    }

    this.targetPower = Math.max(
      0,
      Math.min(1800, Math.round(watts))
    );
  }

  async startOrResume(): Promise<void> {
    // Nothing required for the mock trainer.
  }

  async pause(): Promise<void> {
    // Nothing required for the mock trainer.
  }

  async stop(): Promise<void> {
    // Nothing required for the mock trainer.
  }

  disconnect(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    this._connected = false;
    this.connectionListeners.forEach(listener => listener(false));
  }

  private generateData(): void {
    if (!this._connected) return;

    // Power gradually approaches the requested target.
    this.power += (this.targetPower - this.power) * 0.35;
    this.power += (Math.random() - 0.5) * 6;

    // Simulated cadence.
    this.cadence += (85 - this.cadence) * 0.1;
    this.cadence += (Math.random() - 0.5) * 3;

    const data: BikeData = {
      power: Math.round(this.power),
      cadence: Math.round(this.cadence)
    };

    this.listeners.forEach(listener => listener(data));
  }
}