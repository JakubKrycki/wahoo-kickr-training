export interface BikeData { power?: number; cadence?: number; speed?: number; distance?: number }
export type Listener = (data: BikeData) => void;

export interface Trainer {
  readonly connected: boolean;

  connect(): void;

  onData(listener: Listener): () => void;

  setTargetPower(watts: number): Promise<void>;

  startOrResume(): Promise<void>;

  pause(): Promise<void>;

  stop(): Promise<void>;

  disconnect(): void;
}