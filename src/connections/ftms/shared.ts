export interface BikeData { power?: number; cadence?: number; speed?: number; distance?: number }
export type Listener = (data: BikeData) => void;

export interface Trainer {
  readonly connected: boolean;

  connect(): void;

  onData(listener: Listener): () => void;

  onConnectionChange(listener: (connected: boolean) => void): () => void;

  setTargetPower(watts: number): Promise<void>;

  startOrResume(): Promise<void>;

  pause(): Promise<void>;

  stop(): Promise<void>;

  disconnect(): void;
}

export interface HeartRateData {
  heartRate?: number;
}

export type HeartRateListener = (data: HeartRateData) => void;

export interface HeartRateMonitor {
  readonly connected: boolean;
  readonly isMock: boolean;

  connect(): Promise<void>;

  onData(listener: HeartRateListener): () => void;

  disconnect(): void;

  dispose(): void;
}
