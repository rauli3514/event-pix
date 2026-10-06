import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

// Control del kiosco desde una tablet por Bluetooth (sin internet). Lo básico: la
// pantalla (TV box) le manda a la tablet el título y los botones que hay para tocar
// (solo el texto) y, si la pantalla pide escribir algo, un cuadro de texto. Al tocar un
// botón en la tablet, la pantalla lo aprieta. Además hay flechas y OK como el control
// remoto. Funciona en todas las pantallas sin programar cada una.

export interface RemoteItem { id: string; label: string }
export interface RemoteView {
  t: 'view';
  title: string;
  items: RemoteItem[];
  path: string;
  saver?: boolean;
  /** La pantalla pide escribir (nombre del invitado, búsqueda del Ingreso VIP…) */
  text?: { placeholder: string; value: string };
}
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

export const KioskLink = registerPlugin<KioskLinkPlugin>('KioskLink');

/** Aviso de que se prendió o apagó el control con tablet en Ajustes. */
export const REMOTE_HOST_EVENT = 'kiosk-remote-host-changed';

export const linkAvailable = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('KioskLink');

// ─── Rol del equipo ──────────────────────────────────────────────────────────

const ROLE_KEY = 'kiosk_device_role';
const REMOTE_TARGET_KEY = 'kiosk_remote_target';

/** "remote" = este equipo es la tablet que maneja otra pantalla. */
export const getDeviceRole = () => (localStorage.getItem(ROLE_KEY) === 'remote' ? 'remote' : 'screen');
export const setDeviceRole = (role: 'screen' | 'remote') => localStorage.setItem(ROLE_KEY, role);

export interface RemoteTarget { address: string; name: string }
export const getRemoteTarget = (): RemoteTarget | null => {
  try { return JSON.parse(localStorage.getItem(REMOTE_TARGET_KEY) || 'null'); } catch { return null; }
};
export const setRemoteTarget = (t: RemoteTarget | null) => {
  if (t) localStorage.setItem(REMOTE_TARGET_KEY, JSON.stringify(t));
  else localStorage.removeItem(REMOTE_TARGET_KEY);
};

// ─── Pantalla: qué hay para tocar ────────────────────────────────────────────

const CLICKABLE = 'button, [data-remote]';

const visible = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return false;
  if (r.bottom < 0 || r.right < 0 || r.top > window.innerHeight || r.left > window.innerWidth) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
};

const labelOf = (el: HTMLElement) => {
  const own = el.getAttribute('data-remote') || el.getAttribute('aria-label');
  if (own) return own.trim();
  const text = (el.innerText || '').split('\n').map(s => s.trim()).filter(Boolean);
  return text.slice(0, 2).join(' · ');
};

/** Lo que se ve en la pantalla: título y botones (cada uno con un id para tocarlo). */
export function snapshotView(): RemoteView {
  const saver = !!document.querySelector('.kiosk-saver-in');
  const heading = Array.from(document.querySelectorAll<HTMLElement>('h1, h2, h3')).find(visible);
  const items: RemoteItem[] = [];
  // Los ids viejos se borran: si no, un elemento que quedó oculto puede tener el mismo id
  document.querySelectorAll('[data-remote-id]').forEach(el => el.removeAttribute('data-remote-id'));
  if (!saver) {
    let n = 0;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(CLICKABLE))) {
      if (items.length >= 60) break;
      if ((el as HTMLButtonElement).disabled || el.closest('[data-remote-skip]') || !visible(el)) continue;
      const label = labelOf(el);
      if (!label) continue;
      const id = String(++n);
      el.setAttribute('data-remote-id', id);
      items.push({ id, label: label.slice(0, 48) });
    }
  }
  const textEl = saver ? null : Array.from(document.querySelectorAll<HTMLElement>('[data-remote-text]')).find(visible);
  return {
    t: 'view',
    title: saver ? 'Protector de pantalla: tocá para volver' : (heading?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    items,
    path: location.pathname,
    saver,
    ...(textEl ? { text: { placeholder: textEl.getAttribute('data-remote-text') || 'Escribí acá', value: textEl.getAttribute('data-remote-value') || '' } } : {}),
  };
}

/** Ejecuta en la pantalla lo que mandó la tablet. */
export function runCommand(cmd: RemoteCommand) {
  // Con el protector de pantalla, el primer toque solo lo cierra (como en la pantalla)
  if (document.querySelector('.kiosk-saver-in')) {
    window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return;
  }
  if (cmd.t === 'tap') {
    const el = document.querySelector<HTMLElement>(`[data-remote-id="${CSS.escape(cmd.id)}"]`);
    if (!el) return;
    el.focus?.();
    el.click();
    return;
  }
  if (cmd.t === 'text') {
    window.dispatchEvent(new CustomEvent(REMOTE_TEXT_EVENT, { detail: cmd.value.slice(0, 40) }));
    return;
  }
  if (cmd.t === 'key') {
    const target = (document.activeElement as HTMLElement | null) || document.body;
    // La actividad cuenta para el protector de pantalla
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
    if (cmd.key === 'Enter' && target !== document.body) { target.click(); return; }
    target.dispatchEvent(new KeyboardEvent('keydown', { key: cmd.key, bubbles: true, cancelable: true }));
    target.dispatchEvent(new KeyboardEvent('keyup', { key: cmd.key, bubbles: true, cancelable: true }));
  }
}
