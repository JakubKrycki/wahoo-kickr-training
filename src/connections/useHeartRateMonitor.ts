import { useEffect, useRef, useState } from 'react';
import { HeartRateMonitor } from './heartrate';
import { MockHeartRateMonitor } from './MockHeartRateMonitor';

export function useHeartRateMonitor() {
  const [heartRate, setHeartRate] = useState<number | null>(null);

  const monitorRef = useRef<HeartRateMonitor | null>(null);

  if (monitorRef.current === null) {
    const useMockHeartRate =
      import.meta.env.DEV &&
      import.meta.env.VITE_USE_MOCK_HEART_RATE === "true";

    monitorRef.current = useMockHeartRate
      ? new MockHeartRateMonitor(setHeartRate)
      : new HeartRateMonitor(setHeartRate);
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
