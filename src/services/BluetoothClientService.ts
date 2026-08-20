/**
 * BluetoothClientService.ts
 *
 * Wrapper TypeScript para window.AndroidBluetoothClient (JavascriptInterface nativo).
 * Solo funciona en la app Android nativa — en browser siempre retorna "not_available".
 */

import { Capacitor } from '@capacitor/core';

export interface BluetoothDevice {
  name: string;
  address: string;
}

export type BluetoothEvent =
  | { event: 'connecting'; address: string }
  | { event: 'connected'; address: string; name: string }
  | { event: 'disconnected' }
  | { event: 'response'; data: Record<string, unknown> }
  | { event: 'error'; message: string };

export type BluetoothEventCallback = (event: BluetoothEvent) => void;

declare global {
  interface Window {
    AndroidBluetoothClient?: {
      getPairedDevices(): string;
      connect(address: string): void;
      disconnect(): void;
      sendCommand(jsonCommand: string): void;
      isConnected(): boolean;
    };
    onBluetoothEvent?: (event: BluetoothEvent) => void;
  }
}

class BluetoothClientService {
  private listeners: BluetoothEventCallback[] = [];

  constructor() {
    // Registrar el callback global que el Java llama cuando hay eventos
    if (typeof window !== 'undefined') {
      window.onBluetoothEvent = (event: BluetoothEvent) => {
        this.listeners.forEach(cb => cb(event));
      };
    }
  }

  /** ¿Está disponible el Bluetooth nativo en este dispositivo? */
  isAvailable(): boolean {
    return Capacitor.isNativePlatform() && !!window.AndroidBluetoothClient;
  }

  /** Lista dispositivos Bluetooth ya vinculados (paired) que sean EventPix-TV-* */
  getPairedEventPixDevices(): BluetoothDevice[] {
    if (!this.isAvailable()) return [];
    try {
      const raw = window.AndroidBluetoothClient!.getPairedDevices();
      const parsed = JSON.parse(raw);
      if (parsed.error) {
        console.warn('[BT] getPairedDevices error:', parsed.error);
        return [];
      }
      return (parsed.devices as BluetoothDevice[]) || [];
    } catch (e) {
      console.error('[BT] getPairedDevices parse error', e);
      return [];
    }
  }

  /** Conectar a un TV por dirección MAC. Los eventos llegan vía onEvent(). */
  connect(address: string): void {
    if (!this.isAvailable()) return;
    window.AndroidBluetoothClient!.connect(address);
  }

  /** Desconectar del TV actual. */
  disconnect(): void {
    if (!this.isAvailable()) return;
    window.AndroidBluetoothClient!.disconnect();
  }

  /** ¿Hay conexión activa? */
  isConnected(): boolean {
    if (!this.isAvailable()) return false;
    return window.AndroidBluetoothClient!.isConnected();
  }

  /**
   * Enviar configuración de Wi-Fi al TV.
   * El TV (BluetoothServer.java) recibe el JSON y llama connectWifi().
   */
  sendWifiConfig(ssid: string, password: string): void {
    this.sendCommand({ type: 'wifi', ssid, password });
  }

  /**
   * Enviar un comando genérico al TV en formato JSON.
   * Ejemplo: { type: 'reboot' }, { type: 'volume', level: 80 }
   */
  sendCommand(command: Record<string, unknown>): void {
    if (!this.isAvailable()) return;
    const json = JSON.stringify(command);
    window.AndroidBluetoothClient!.sendCommand(json);
  }

  /** Suscribirse a eventos Bluetooth */
  onEvent(callback: BluetoothEventCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }
}

// Singleton
export const bluetoothClient = new BluetoothClientService();
