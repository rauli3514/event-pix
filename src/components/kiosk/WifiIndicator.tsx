import { useEffect, useState } from 'react';
import { Cable } from 'lucide-react';
import { KioskNet, netAvailable, type WifiStatus } from '@/lib/kioskNet';

// Antenita del inicio: solo muestra si hay conexión y cuánta señal (no se toca).
// El WiFi se configura en Ajustes → Equipo.

const POLL_MS = 10000;

export default function WifiIndicator({ className = '' }: { className?: string }) {
  const [status, setStatus] = useState<WifiStatus | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const onChange = () => setOnline(navigator.onLine);
    window.addEventListener('online', onChange);
    window.addEventListener('offline', onChange);
    let alive = true;
    const read = () => {
      if (!netAvailable()) return;
      KioskNet.wifiStatus().then(s => { if (alive) setStatus(s); }).catch(() => {});
    };
    read();
    const t = window.setInterval(read, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(t);
      window.removeEventListener('online', onChange);
      window.removeEventListener('offline', onChange);
    };
  }, []);

  const connected = status ? status.connected : online;
  const internet = status ? status.internet : online;
  // Sin dato de señal (web o cable) se muestra completa si hay conexión
  const bars = !connected ? 0 : status?.bars ?? 4;
  const color = !connected ? 'text-red-400' : internet ? 'text-white/90' : 'text-amber-300';
  const label = !connected ? 'Sin conexión' : `${status?.ethernet ? 'Conectado por cable' : `WiFi${status?.ssid ? ` ${status.ssid}` : ''}`}${internet ? '' : ' · sin internet'}`;

  return (
    <div role="img" aria-label={label} title={label} className={`flex items-center justify-center ${color} ${className}`}>
      {status?.ethernet ? <Cable className="w-7 h-7" /> : <SignalArcs bars={bars} off={!connected} />}
    </div>
  );
}

/** Ícono de WiFi con las rayitas encendidas según la señal (0 a 4). */
function SignalArcs({ bars, off }: { bars: number; off: boolean }) {
  const arcs = [
    'M12 20h.01',
    'M8.5 16.4a5 5 0 0 1 7 0',
    'M5 12.9a10 10 0 0 1 14 0',
    'M1.5 9.4a15 15 0 0 1 21 0',
  ];
  // La señal 1 enciende el punto, 4 enciende todo
  const lit = Math.max(0, Math.min(4, bars));
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      {arcs.map((d, i) => <path key={d} d={d} opacity={i < lit ? 1 : 0.25} />)}
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}
