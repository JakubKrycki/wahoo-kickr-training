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
  private pendingResolve?: (ok: boolean) => void;
  private pendingReject?: (error: Error) => void;
  private timeout?: number;
  private supportsResistanceTarget = false;

  get connected() { return !!this.server?.connected; }

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
    this.device.addEventListener("gattserverdisconnected", () => {
      this.server = undefined;
      this.controlPoint = undefined;
    });
    this.server = await this.device.gatt!.connect();
    const service = await this.server.getPrimaryService(FTMS_SERVICE);

    const bikeData = await service.getCharacteristic(INDOOR_BIKE_DATA);
    await bikeData.startNotifications();
    bikeData.addEventListener("characteristicvaluechanged", this.handleBikeData);

    this.controlPoint = await service.getCharacteristic(CONTROL_POINT);
    await this.controlPoint.startNotifications();
    this.controlPoint.addEventListener("characteristicvaluechanged", this.handleControlResponse);

    // FTMS Feature's second 32-bit field advertises supported target-setting procedures.
    // Bit 2 means Set Target Resistance Level is supported.
    try {
      const feature = await service.getCharacteristic(FITNESS_MACHINE_FEATURE);
      const value = await feature.readValue();
      if (value.byteLength >= 8) this.supportsResistanceTarget = (value.getUint32(4, true) & 0x00000004) !== 0;
    } catch {
      this.supportsResistanceTarget = false;
    }

    await this.command(new Uint8Array([0x00])); // Request Control
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

  async setTargetResistance(level = 0) {
    if (!this.supportsResistanceTarget) {
      throw new Error("This trainer has not advertised FTMS resistance control. Free-ride test cannot safely switch out of ERG mode.");
    }
    if (!Number.isFinite(level)) throw new Error("Invalid resistance level.");
    const safeLevel = Math.max(-100, Math.min(100, Math.round(level * 10)));
    const payload = new Uint8Array(3);
    payload[0] = 0x04; // Set Target Resistance Level (0.1 units)
    new DataView(payload.buffer).setInt16(1, safeLevel, true);
    await this.command(payload);
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
    this.server = undefined;
    this.controlPoint = undefined;
    this.supportsResistanceTarget = false;
  }
}