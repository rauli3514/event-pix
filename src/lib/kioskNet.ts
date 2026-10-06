import { Capacitor, registerPlugin } from '@capacitor/core';

// WiFi y Bluetooth del equipo desde la app (plugin KioskNet de la APK). En la web
// no hay acceso: los paneles muestran que se usa en el equipo.

export type WifiSecurity = 'open' | 'wpa2' | 'wpa3' | 'wep' | 'enterprise';
export interface WifiNetwork { ssid: string; bars: number; security: WifiSecurity }
export interface WifiStatus { enabled: boolean; connected: boolean; internet: boolean; ssid: string; ethernet?: boolean }
export interface BtDevice { name: string; address: string; bonded: boolean; kind: 'input' | 'audio' | 'phone' | 'printer' | 'computer' | 'other' }
export interface BtStatus { supported: boolean; enabled?: boolean; bonded?: BtDevice[]; needsPermission?: boolean }

interface KioskNetPlugin {
  wifiStatus(): Promise<WifiStatus>;
  wifiScan(): Promise<{ networks: WifiNetwork[]; wifiEnabled: boolean; locationOff: boolean }>;
  wifiConnect(o: { ssid: string; password: string; security: WifiSecurity }): Promise<{ method: 'dialog' | 'suggestion' | 'direct' }>;
  btStatus(): Promise<BtStatus>;
  btEnable(): Promise<{ method?: string }>;
  btScan(): Promise<{ devices: BtDevice[]; locationOff: boolean }>;
  btPair(o: { address: string }): Promise<{ started: boolean }>;
  btUnpair(o: { address: string }): Promise<{ removed: boolean }>;
}

export const KioskNet = registerPlugin<KioskNetPlugin>('KioskNet');

/** El plugin está si es la app nativa y la APK lo trae (v2.1 o más nueva). */
export const netAvailable = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('KioskNet');

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
