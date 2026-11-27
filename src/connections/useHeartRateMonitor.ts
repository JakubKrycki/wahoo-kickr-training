import { useEffect, useMemo, useState } from 'react';
import { BluetoothHeartRateMonitor } from './heartrate';
import { MockHeartRateMonitor } from './MockHeartRateMonitor';
import { HeartRateMonitor } from './ftms/shared';

export function useHeartRateMonitor() {
  const [heartRate, setHeartRate] = useState<number | null>(null);

  const useMockHeartRate =
    import.meta.env.DEV &&
    import.meta.env.VITE_USE_MOCK_HEART_RATE === "true";

  const heartRateMonitor: HeartRateMonitor = useMemo(
    () => useMockHeartRate
      ? new MockHeartRateMonitor()
      : new BluetoothHeartRateMonitor(),
    []
  );

  const [heartRateConnected, setHeartRateConnected] = useState(heartRateMonitor.connected);

  useEffect(() => {
    const unsubscribeConnection = heartRateMonitor.onConnectionChange(setHeartRateConnected);
    const unsubscribe = heartRateMonitor.onData(({ heartRate: bpm }) => {
      setHeartRate(bpm ?? null);
    });

    return () => {
      unsubscribe();
      unsubscribeConnection();
      heartRateMonitor.dispose();
    };
  }, [heartRateMonitor]);

  return {
    heartRate,
    heartRateConnected,
    heartRateMonitor,
  };
}
