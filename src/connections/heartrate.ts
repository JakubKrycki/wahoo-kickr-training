/**
 * HeartCast broadcasts the standard Bluetooth LE Heart Rate service.
 * The app reads the Heart Rate Measurement characteristic and exposes BPM.
 */
export class HeartRateMonitor {
  private device?: BluetoothDevice;
  private characteristic?: BluetoothRemoteGATTCharacteristic;
  private onHeartRate: (bpm: number | null) => void;

  constructor(onHeartRate: (bpm: number | null) => void) {
    this.onHeartRate = onHeartRate;
  }

  get connected() {
    return !!this.device?.gatt?.connected;
  }

  get name() {
    return this.device?.name ?? "Heart-rate device";
  }

  async connect(): Promise<string> {
    if (!("bluetooth" in navigator)) {
      throw new Error("Web Bluetooth is unavailable. Use Chrome or Edge on your laptop.");
    }

    // Must be called directly from the Connect HeartCast button click.
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: ["heart_rate"] }],
      optionalServices: ["heart_rate"]
    });

    device.addEventListener("gattserverdisconnected", this.handleDisconnected);
    const server = await device.gatt!.connect();
    const service = await server.getPrimaryService("heart_rate");
    const characteristic = await service.getCharacteristic("heart_rate_measurement");

    this.device = device;
    this.characteristic = characteristic;
    characteristic.addEventListener("characteristicvaluechanged", this.handleMeasurement);
    await characteristic.startNotifications();

    return device.name ?? "HeartCast";
  }

  private handleMeasurement = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!value || value.byteLength < 2) return;

    const flags = value.getUint8(0);
    const bpm = (flags & 0x01) !== 0
      ? (value.byteLength >= 3 ? value.getUint16(1, true) : NaN)
      : value.getUint8(1);

    if (Number.isFinite(bpm) && bpm > 0) this.onHeartRate(bpm);
  };

  private handleDisconnected = () => {
    this.characteristic?.removeEventListener("characteristicvaluechanged", this.handleMeasurement);
    this.characteristic = undefined;
    this.device = undefined;
    this.onHeartRate(null);
  };

  disconnect() {
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
    else this.handleDisconnected();
  }
}
