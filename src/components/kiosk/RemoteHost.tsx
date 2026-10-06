import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getGeneralSettings } from '@/lib/kioskSettings';
import { KioskLink, linkAvailable, REMOTE_HOST_EVENT, runCommand, snapshotView, type RemoteCommand } from '@/lib/kioskLink';

// Pantalla del kiosco manejada desde una tablet por Bluetooth (Ajustes → Equipo →
// Control con tablet). Escucha a la tablet, le manda lo que hay en pantalla cada vez
// que cambia y aprieta lo que la tablet toca. No dibuja nada.

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
    const send = (force = false) => {
      if (!connected) return;
      const data = JSON.stringify(snapshotView());
      if (!force && data === last) return;
      last = data;
      KioskLink.send({ data }).catch(() => { /* se reconecta sola */ });
    };
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
        if (connected) { last = ''; window.setTimeout(() => send(true), 300); }
      }),
      KioskLink.addListener('linkMessage', e => {
        try {
          const cmd = JSON.parse(e.data) as RemoteCommand;
          if (cmd.t === 'hello') { last = ''; send(true); return; }
          runCommand(cmd);
          window.setTimeout(() => send(), 250);
        } catch { /* mensaje inválido */ }
      }),
    ];
    if (!started) {
      started = true;
      KioskLink.startHost().catch(() => { started = false; });
    }
    KioskLink.info().then(i => { connected = i.connected; if (connected) send(true); }).catch(() => {});

    return () => {
      observer.disconnect();
      window.clearInterval(safety);
      window.clearTimeout(timer);
      handles.forEach(h => h.then(x => x.remove()).catch(() => {}));
    };
  }, [active]);

  return null;
}
