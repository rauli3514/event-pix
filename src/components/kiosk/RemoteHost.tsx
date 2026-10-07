import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getGeneralSettings } from '@/lib/kioskSettings';
import { KioskLink, linkAvailable, REMOTE_HOST_EVENT, type RemoteCommand, type RemoteView } from '@/lib/kioskLink';
import { runCommand, snapshotView, thumbnail } from '@/lib/kioskLinkHost';

// Pantalla del kiosco manejada desde una tablet por Bluetooth (Ajustes → Equipo →
// Control con tablet). Escucha a la tablet (app EventPix Control), le manda lo que hay
// en pantalla cada vez que cambia, con las miniaturas que todavía no tiene, y aprieta
// lo que la tablet toca. No dibuja nada.

/** Lado más largo de las miniaturas: tarjetas y foto grande */
const CARD_PX = 360;
const PHOTO_PX = 900;

const KIOSK_PATH = /^\/(box|kiosco)(\/|$)/;
const inFrame = (() => { try { return window.self !== window.top; } catch { return true; } })();

let started = false;

export default function RemoteHost() {
  const { pathname } = useLocation();
  // Se vuelve a evaluar cuando se prende o apaga en Ajustes
  const [rev, setRev] = useState(0);
  useEffect(() => {
    const bump = () => setRev(r => r + 1);
    window.addEventListener(REMOTE_HOST_EVENT, bump);
    return () => window.removeEventListener(REMOTE_HOST_EVENT, bump);
  }, []);
  const active = !inFrame && KIOSK_PATH.test(pathname) && linkAvailable() && getGeneralSettings().remoteHost === true;

  // Si se apaga el control con tablet, la pantalla deja de escuchar
  useEffect(() => {
    if (started && linkAvailable() && getGeneralSettings().remoteHost !== true) {
      started = false;
      KioskLink.stopHost().catch(() => {});
    }
  }, [pathname, rev]);

  useEffect(() => {
    if (!active) return;
    let connected = false;
    let last = '';
    let timer = 0;
    // Miniaturas que la tablet ya tiene (en esta conexión), y la cola para mandar de a una
    let sent = new Set<string>();
    let queue: { key: string; px: number }[] = [];
    let sending = false;
    const pump = async () => {
      if (sending) return;
      sending = true;
      while (connected && queue.length) {
        const { key, px } = queue.shift()!;
        if (sent.has(key)) continue;
        const data = await thumbnail(key, px);
        sent.add(key);
        if (!data || !connected) continue;
        await KioskLink.send({ data: JSON.stringify({ t: 'img', key, data }) }).catch(() => {});
      }
      sending = false;
    };
    const sendImages = (view: RemoteView) => {
      // La foto grande primero: es lo que el invitado espera ver
      const wanted = [
        ...(view.image ? [{ key: view.image, px: PHOTO_PX }] : []),
        ...view.items.filter(i => i.img).map(i => ({ key: i.img!, px: CARD_PX })),
      ].filter(w => !sent.has(w.key) && !queue.some(q => q.key === w.key));
      if (!wanted.length) return;
      queue = [...wanted, ...queue];
      void pump();
    };
    const send = (force = false) => {
      if (!connected) return;
      const view = snapshotView();
      const data = JSON.stringify(view);
      if (!force && data === last) return;
      last = data;
      KioskLink.send({ data }).catch(() => { /* se reconecta sola */ });
      sendImages(view);
    };
    const restart = () => { last = ''; sent = new Set(); queue = []; };
    // Lo que cambia en pantalla se manda agrupado (como mucho cada 0,4 s)
    const schedule = () => {
      if (timer) return;
      timer = window.setTimeout(() => { timer = 0; send(); }, 400);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'disabled', 'src', 'aria-label', 'style'] });
    const safety = window.setInterval(() => send(), 3000);

    const handles = [
      KioskLink.addListener('linkState', e => {
        connected = e.state === 'connected';
        if (connected) { restart(); window.setTimeout(() => send(true), 300); }
      }),
      KioskLink.addListener('linkMessage', e => {
        try {
          const cmd = JSON.parse(e.data) as RemoteCommand;
          // La tablet (re)conectada no tiene ninguna imagen
          if (cmd.t === 'hello') { restart(); send(true); return; }
          runCommand(cmd);
          window.setTimeout(() => send(), 250);
        } catch { /* mensaje inválido */ }
      }),
    ];
    // Si no puede escuchar (p. ej. Bluetooth apagado) se reintenta cada 10 s
    let retry = 0;
    const start = () => {
      if (started) return;
      started = true;
      KioskLink.startHost().catch(() => {
        started = false;
        retry = window.setTimeout(start, 10000);
      });
    };
    start();
    KioskLink.info().then(i => { connected = i.connected; if (connected) send(true); }).catch(() => {});

    return () => {
      observer.disconnect();
      window.clearInterval(safety);
      window.clearTimeout(timer);
      window.clearTimeout(retry);
      handles.forEach(h => h.then(x => x.remove()).catch(() => {}));
    };
  }, [active]);

  return null;
}
