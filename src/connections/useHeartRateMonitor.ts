import { useEffect, useRef, useState } from 'react';
import { HeartRateMonitor } from './heartrate';

export function useHeartRateMonitor() {
  const [heartRate, setHeartRate] = useState<number | null>(null);

  const monitorRef = useRef<HeartRateMonitor | null>(null);

  if (monitorRef.current === null) {
    monitorRef.current = new HeartRateMonitor(setHeartRate);
  }

  useEffect(() => {
    const monitor = monitorRef.current!;

    return () => {
      void monitor.dispose();
    };
  }, []);

  return {
    heartRate,
    heartRateMonitor: monitorRef.current,
  };
}