import { useMemo } from 'react';
import { FtmsTrainer } from './FtmsTrainer';
import { MockFtmsTrainer } from './MockFtmsTrainer';
import { Trainer } from './shared';

export function useFtmsTrainer() {
  
  const useMockTrainer =
    import.meta.env.DEV &&
    import.meta.env.VITE_USE_MOCK_TRAINER === "true";

  const trainer: Trainer = useMemo(
    () => {
      console.log('Mock trainer enabled:', useMockTrainer);
      return useMockTrainer
      ? new MockFtmsTrainer()
      : new FtmsTrainer();
    },
    []
  );

  return { trainer };
}