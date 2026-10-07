import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

// Control del kiosco desde una tablet por Bluetooth (sin internet). La pantalla (TV box)
// le manda a la tablet lo que hay para elegir: título, botones con su imagen (miniaturas
// que viajan por el mismo Bluetooth), la foto recién sacada y, si la pantalla pide
// escribir algo, un cuadro de texto. Al tocar en la tablet, la pantalla lo aprieta.
// Lo usan las dos apps: EventPix Kiosco (la pantalla, ver kioskLinkHost) y EventPix
// Control (la tablet), así que acá no hay nada del kiosco.

export interface RemoteItem {
  id: string;
  label: string;
  /** Clave de la miniatura (llega aparte con un mensaje "img") */
  img?: string;
  /** Texto chico debajo del nombre (p. ej. la descripción del modo) */
  sub?: string;
  /** Opción elegida (p. ej. el estilo de IA marcado) */
  selected?: boolean;
  /** Opción destacada (p. ej. Retrato Mágico) */
  featured?: boolean;
  /** Botón principal (p. ej. "¡Me gusta!") */
  primary?: boolean;
}
export interface RemoteView {
  t: 'view';
  title: string;
  items: RemoteItem[];
  path: string;
  saver?: boolean;
  /** La pantalla pide escribir (nombre del invitado, búsqueda del Ingreso VIP…) */
  text?: { placeholder: string; value: string };
  /** Imagen grande (la foto recién sacada o la foto final) */
  image?: string;
  /** Pasa algo que hay que mirar en la pantalla grande (cuenta regresiva, cámara…) */
  watch?: string;
}
/** Miniatura que manda la pantalla (data URL JPEG) */
export interface RemoteImage { t: 'img'; key: string; data: string }
export type RemoteMessage = RemoteView | RemoteImage;

export type RemoteCommand =
  | { t: 'hello' }
  | { t: 'tap'; id: string }
  | { t: 'text'; value: string }
  | { t: 'key'; key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Enter' };

/** Las pantallas con texto (data-remote-text) reciben lo que se escribe en la tablet con este evento. */
export const REMOTE_TEXT_EVENT = 'kiosk-remote-text';

export type LinkState = 'listening' | 'connected' | 'disconnected' | 'stopped';

interface KioskLinkPlugin {
  info(): Promise<{ supported: boolean; enabled?: boolean; name?: string; hosting: boolean; connected: boolean }>;
  startHost(): Promise<void>;
  stopHost(): Promise<void>;
  makeDiscoverable(): Promise<void>;
  connect(o: { address: string }): Promise<{ name?: string }>;
  disconnect(): Promise<void>;
  send(o: { data: string }): Promise<void>;
  addListener(event: 'linkState', cb: (e: { state: LinkState; name?: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'linkMessage', cb: (e: { data: string }) => void): Promise<PluginListenerHandle>;
}

// Solo en desarrollo: ?mocklink=host | remote conecta dos pestañas del navegador como si
// fuera Bluetooth (para probar la pantalla y la tablet juntas). No existe en la app.
const mockRole = import.meta.env.DEV ? new URLSearchParams(location.search).get('mocklink') : null;

function mockLink(role: string): KioskLinkPlugin {
  const other = role === 'host' ? 'remote' : 'host';
  const ch = new BroadcastChannel('kiosk-mock-link');
  const listeners: Record<string, ((e: never) => void)[]> = { linkState: [], linkMessage: [] };
  const emit = (ev: string, e: unknown) => listeners[ev].forEach(cb => cb(e as never));
  let connected = false;
  ch.onmessage = ({ data: m }) => {
    if (m.to !== role) return;
    if (m.type === 'connect') { connected = true; emit('linkState', { state: 'connected', name: 'Tablet (simulada)' }); }
    if (m.type === 'data') emit('linkMessage', { data: m.data });
  };
  return {
    info: async () => ({ supported: true, enabled: true, name: 'Pantalla (simulada)', hosting: role === 'host', connected }),
    startHost: async () => {},
    stopHost: async () => {},
    makeDiscoverable: async () => {},
    connect: async () => { connected = true; ch.postMessage({ to: other, type: 'connect' }); return { name: 'Pantalla (simulada)' }; },
    disconnect: async () => { connected = false; },
    send: async ({ data }) => { ch.postMessage({ to: other, type: 'data', data }); },
    addListener: (async (ev: string, cb: (e: never) => void) => {
      listeners[ev].push(cb);
      return { remove: async () => { listeners[ev] = listeners[ev].filter(x => x !== cb); } };
    }) as KioskLinkPlugin['addListener'],
  };
}

export const KioskLink = mockRole ? mockLink(mockRole) : registerPlugin<KioskLinkPlugin>('KioskLink');

/** Aviso de que se prendió o apagó el control con tablet en Ajustes. */
export const REMOTE_HOST_EVENT = 'kiosk-remote-host-changed';

export const linkAvailable = () => !!mockRole || (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('KioskLink'));

// ─── Tablet: pantalla elegida ────────────────────────────────────────────────

const REMOTE_TARGET_KEY = 'kiosk_remote_target';

export interface RemoteTarget { address: string; name: string }
export const getRemoteTarget = (): RemoteTarget | null => {
  try { return JSON.parse(localStorage.getItem(REMOTE_TARGET_KEY) || 'null'); } catch { return null; }
};
export const setRemoteTarget = (t: RemoteTarget | null) => {
  if (t) localStorage.setItem(REMOTE_TARGET_KEY, JSON.stringify(t));
  else localStorage.removeItem(REMOTE_TARGET_KEY);
};
