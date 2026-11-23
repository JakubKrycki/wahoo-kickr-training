import { HeartRateData, HeartRateListener, HeartRateMonitor } from './ftms/shared';

/**
 * HeartCast broadcasts the standard Bluetooth LE Heart Rate service.
 * This class reads the standard Heart Rate Measurement characteristic and
 * publishes BPM through the shared monitor interface.
 */
export class BluetoothHeartRateMonitor implements HeartRateMonitor {
  private device?: BluetoothDevice;
  private characteristic?: BluetoothRemoteGATTCharacteristic;
  private listeners = new Set<HeartRateListener>();

  get connected() {
    return !!this.device?.gatt?.connected;
  }

  get isMock() {
    return false;
  }

  onData(listener: HeartRateListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async connect(): Promise<void> {
    if (!("bluetooth" in navigator)) {
      throw new Error("Web Bluetooth is unavailable. Use Chrome or Edge on your laptop.");
    }

    // Must be invoked directly from the user-initiated connect action.
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: ["heart_rate"] }],
      optionalServices: ["heart_rate"]
    });

    this.device = device;
    device.addEventListener("gattserverdisconnected", this.handleDisconnected);
    const server = await device.gatt!.connect();
    const service = await server.getPrimaryService("heart_rate");
    const characteristic = await service.getCharacteristic("heart_rate_measurement");

    this.characteristic = characteristic;
    characteristic.addEventListener("characteristicvaluechanged", this.handleMeasurement);
    await characteristic.startNotifications();
  }

  private publish(data: HeartRateData) {
    this.listeners.forEach(listener => listener(data));
  }

  private handleMeasurement = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!value || value.byteLength < 2) return;

    const flags = value.getUint8(0);
    const bpm = (flags & 0x01) !== 0
      ? (value.byteLength >= 3 ? value.getUint16(1, true) : NaN)
      : value.getUint8(1);

    if (Number.isFinite(bpm) && bpm > 0) this.publish({ heartRate: bpm });
  };

  private handleDisconnected = () => {
    this.characteristic?.removeEventListener("characteristicvaluechanged", this.handleMeasurement);
    this.characteristic = undefined;
    this.device = undefined;
    this.publish({});
  };

  disconnect() {
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
    else this.handleDisconnected();
  }

  dispose() {
    this.disconnect();
    this.listeners.clear();
  }
}
