import { REMOTE_TEXT_EVENT, type RemoteCommand, type RemoteItem, type RemoteView } from '@/lib/kioskLink';

// Lado de la pantalla (EventPix Kiosco) del control con tablet: mira lo que se ve,
// arma la "vista" para la tablet y aprieta lo que la tablet toca. Funciona con todas
// las pantallas sin programar cada una; se ayuda con atributos en el HTML:
//  - data-remote="Texto"          nombre del botón en la tablet (o un elemento tocable)
//  - data-remote-sub="…"          texto chico debajo del nombre
//  - data-remote-selected / -featured / -primary  opción elegida / destacada / botón principal
//  - data-remote-noimg            no buscar imagen adentro (fondos)
//  - data-remote-skip             no mostrar lo que está adentro (p. ej. el teclado en pantalla)
//  - data-remote-text="Placeholder" + data-remote-value  cuadro para escribir
//  - data-remote-image            imagen grande para la tablet (la foto)
//  - data-remote-watch="Texto"    pantalla para mirar en la tele (cuenta regresiva…)

const CLICKABLE = 'button, [data-remote]';
/** Botón comodín de la tablet: toca el centro de la pantalla. */
const SCREEN_ID = 'screen';

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

// ─── Imágenes ────────────────────────────────────────────────────────────────

/** Clave corta para una imagen (las fotos son data URL larguísimas) */
const keyOf = (src: string) => {
  let h = 5381;
  const step = Math.max(1, Math.floor(src.length / 4000));
  for (let i = 0; i < src.length; i += step) h = ((h << 5) + h + src.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + src.length.toString(36);
};

const sources = new Map<string, string>();
const remember = (src: string) => {
  const key = keyOf(src);
  sources.set(key, src);
  return key;
};

/** Imagen de una tarjeta: la primera que tenga un tamaño razonable (no íconos) */
const imageIn = (el: HTMLElement) => {
  const img = Array.from(el.querySelectorAll('img')).find(i => {
    const r = i.getBoundingClientRect();
    return r.width >= 40 && r.height >= 30 && (i.currentSrc || i.src);
  });
  return img ? remember(img.currentSrc || img.src) : undefined;
};

const thumbs = new Map<string, Promise<string | null>>();

/**
 * Miniatura JPEG de una imagen de la pantalla, para mandar por Bluetooth (las de las
 * tarjetas chicas, la foto más grande). Si no se puede (imagen de otro sitio sin
 * permiso), null: la tablet muestra solo el texto.
 */
export function thumbnail(key: string, max: number): Promise<string | null> {
  const id = `${key}@${max}`;
  const cached = thumbs.get(id);
  if (cached) return cached;
  const src = sources.get(key);
  if (!src) return Promise.resolve(null);
  const p = new Promise<string | null>(resolve => {
    const img = new Image();
    if (!src.startsWith('data:') && !src.startsWith('blob:') && !src.startsWith(location.origin)) img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const scale = Math.min(1, max / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
  thumbs.set(id, p);
  // No se guardan para siempre (las fotos de cada invitado son distintas)
  if (thumbs.size > 120) thumbs.delete(thumbs.keys().next().value as string);
  return p;
}

// ─── Vista ───────────────────────────────────────────────────────────────────

/** Lo que se ve en la pantalla: título, botones (con id para tocarlos), foto y texto. */
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
      const sub = el.getAttribute('data-remote-sub');
      items.push({
        id,
        label: label.slice(0, 48),
        ...(el.hasAttribute('data-remote-noimg') ? {} : { img: imageIn(el) }),
        ...(sub ? { sub: sub.slice(0, 90) } : {}),
        ...(el.hasAttribute('data-remote-selected') ? { selected: true } : {}),
        ...(el.hasAttribute('data-remote-featured') ? { featured: true } : {}),
        ...(el.hasAttribute('data-remote-primary') ? { primary: true } : {}),
      });
    }
  }
  const textEl = saver ? null : Array.from(document.querySelectorAll<HTMLElement>('[data-remote-text]')).find(visible);
  const watchEl = saver ? null : Array.from(document.querySelectorAll<HTMLElement>('[data-remote-watch]')).find(visible);
  const imageEl = saver ? null : Array.from(document.querySelectorAll<HTMLElement>('[data-remote-image]')).find(visible);
  const imageSrc = imageEl instanceof HTMLImageElement ? imageEl.currentSrc || imageEl.src : imageEl?.getAttribute('data-remote-image');
  // Pantalla sin botones (p. ej. "tocá para seguir"): la tablet igual puede tocarla
  if (!saver && items.length === 0 && !textEl && !watchEl) items.push({ id: SCREEN_ID, label: 'Tocar la pantalla' });
  return {
    t: 'view',
    title: saver ? 'Protector de pantalla: tocá para volver' : (heading?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    items,
    path: location.pathname,
    saver,
    ...(textEl ? { text: { placeholder: textEl.getAttribute('data-remote-text') || 'Escribí acá', value: textEl.getAttribute('data-remote-value') || '' } } : {}),
    ...(watchEl ? { watch: watchEl.getAttribute('data-remote-watch') || '¡Mirá la pantalla grande!' } : {}),
    ...(imageSrc ? { image: remember(imageSrc) } : {}),
  };
}

/** Ejecuta en la pantalla lo que mandó la tablet. */
export function runCommand(cmd: RemoteCommand) {
  // Con el protector de pantalla, el primer toque solo lo cierra (como en la pantalla)
  if (document.querySelector('.kiosk-saver-in')) {
    window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return;
  }
  if (cmd.t === 'tap' && cmd.id === SCREEN_ID) {
    const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2) as HTMLElement | null;
    el?.click();
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
