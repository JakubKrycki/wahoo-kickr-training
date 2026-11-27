// Bluetooth Fitness Machine Service (FTMS) client.

import { BikeData, Listener, Trainer } from './shared';

// KICKR CORE 2 support must be verified on the actual unit/firmware.
const FTMS_SERVICE = 0x1826;
const INDOOR_BIKE_DATA = 0x2ad2;
const FITNESS_MACHINE_FEATURE = 0x2acc;
const CONTROL_POINT = 0x2ad9;

export class FtmsTrainer implements Trainer {
  private device?: BluetoothDevice;
  private server?: BluetoothRemoteGATTServer;
  private controlPoint?: BluetoothRemoteGATTCharacteristic;
  private listeners = new Set<Listener>();
  private connectionListeners = new Set<(connected: boolean) => void>();
  private handleDisconnected = () => {
    this.server = undefined;
    this.controlPoint = undefined;
    this.notifyConnection(false);
  };
  private pendingResolve?: (ok: boolean) => void;
  private pendingReject?: (error: Error) => void;
  private timeout?: number;

  get connected() { return !!this.server?.connected; }

  onConnectionChange(listener: (connected: boolean) => void) {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  private notifyConnection(connected: boolean) {
    for (const listener of this.connectionListeners) listener(connected);
  }

  onData(listener: Listener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };  
  }

  async connect() {
    if (!("bluetooth" in navigator)) {
      throw new Error("Web Bluetooth is unavailable. Use a recent Chrome or Edge browser.");
    }
    // The chooser must be opened directly from a user click.
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [FTMS_SERVICE] }],
      optionalServices: [FTMS_SERVICE]
    });
    this.device.removeEventListener("gattserverdisconnected", this.handleDisconnected);
    this.device.addEventListener("gattserverdisconnected", this.handleDisconnected);
    this.server = await this.device.gatt!.connect();
    const service = await this.server.getPrimaryService(FTMS_SERVICE);

    const bikeData = await service.getCharacteristic(INDOOR_BIKE_DATA);
    await bikeData.startNotifications();
    bikeData.addEventListener("characteristicvaluechanged", this.handleBikeData);

    this.controlPoint = await service.getCharacteristic(CONTROL_POINT);
    await this.controlPoint.startNotifications();
    this.controlPoint.addEventListener("characteristicvaluechanged", this.handleControlResponse);

    // FTMS Target Setting Features is the second uint32 in this characteristic.
    const feature = await service.getCharacteristic(FITNESS_MACHINE_FEATURE);
    const featureValue = await feature.readValue();
    if (featureValue.byteLength < 8) {
      throw new Error("Trainer returned an incomplete FTMS feature descriptor.");
    }
    const targetSettingFeatures = featureValue.getUint32(4, true);
    const supportsPowerTarget = (targetSettingFeatures & (1 << 3)) !== 0;
    if (!supportsPowerTarget) {
      throw new Error("This trainer does not advertise FTMS target power control.");
    }

    await this.command(new Uint8Array([0x00])); // Request Control
    this.notifyConnection(true);
  }

  private handleBikeData = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!value || value.byteLength < 4) return;
    const flags = value.getUint16(0, true);
    let offset = 2;
    const data: BikeData = {};

    // FTMS Indoor Bike Data: speed is mandatory unless More Data flag is set.
    if ((flags & 0x0001) === 0) {
      if (value.byteLength >= offset + 2) {
        data.speed = value.getUint16(offset, true) / 100;
        offset += 2;
      }
    }
    // Average speed present
    if (flags & 0x0002) offset += 2;
    // Instantaneous cadence, 0.5 rpm units
    if (flags & 0x0004) {
      if (value.byteLength >= offset + 2) data.cadence = value.getUint16(offset, true) / 2;
      offset += 2;
    }
    // Average cadence
    if (flags & 0x0008) offset += 2;
    // Total distance (uint24, meters)
    if (flags & 0x0010) {
      if (value.byteLength >= offset + 3) {
        data.distance = value.getUint8(offset)
          | (value.getUint8(offset + 1) << 8)
          | (value.getUint8(offset + 2) << 16);
      }
      offset += 3;
    }
    // Resistance level
    if (flags & 0x0020) offset += 2;
    // Instantaneous power (sint16 watts)
    if (flags & 0x0040) {
      if (value.byteLength >= offset + 2) data.power = value.getInt16(offset, true);
      offset += 2;
    }
    for (const listener of this.listeners) listener(data);
  };

  private handleControlResponse = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!value || value.byteLength < 3 || value.getUint8(0) !== 0x80) return;
    const result = value.getUint8(2);
    if (this.timeout) window.clearTimeout(this.timeout);
    const resolve = this.pendingResolve;
    const reject = this.pendingReject;
    this.pendingResolve = undefined;
    this.pendingReject = undefined;
    if (result === 0x01) resolve?.(true);
    else reject?.(new Error(`Trainer rejected FTMS command (result ${result}).`));
  };

  private async command(bytes: Uint8Array): Promise<void> {
    if (!this.controlPoint) throw new Error("Trainer is not connected.");
    if (this.pendingResolve) throw new Error("Trainer is still processing the previous command.");
    const characteristic = this.controlPoint;
    const response = new Promise<void>((resolve, reject) => {
      this.pendingResolve = () => resolve();
      this.pendingReject = reject;
      this.timeout = window.setTimeout(() => {
        this.pendingResolve = undefined;
        this.pendingReject = undefined;
        reject(new Error("Timed out waiting for trainer response."));
      }, 4000);
    });
    try {
      await characteristic.writeValue(bytes);
      await response;
    } catch (error) {
      if (this.timeout) window.clearTimeout(this.timeout);
      this.pendingResolve = undefined;
      this.pendingReject = undefined;
      throw error;
    }
  }

  async setTargetPower(watts: number) {
    if (!Number.isFinite(watts)) throw new Error("Invalid power target.");
    const safeWatts = Math.max(0, Math.min(1800, Math.round(watts)));
    const payload = new Uint8Array(3);
    payload[0] = 0x05; // Set Target Power
    new DataView(payload.buffer).setInt16(1, safeWatts, true);
    await this.command(payload);
  }

  async startOrResume() { await this.command(new Uint8Array([0x07])); }
  async pause() { await this.command(new Uint8Array([0x08, 0x02])); }
  async stop() { await this.command(new Uint8Array([0x08, 0x01])); }

  disconnect() {
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
    else this.handleDisconnected();
    this.server = undefined;
    this.controlPoint = undefined;
  }
}