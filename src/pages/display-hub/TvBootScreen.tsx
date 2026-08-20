import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Wifi, Bluetooth, Power } from 'lucide-react';

export default function TvBootScreen() {
  const [pin, setPin] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    // Start Bluetooth Server on native Android
    if ((window as any).AndroidKiosk?.startBluetoothServer) {
      (window as any).AndroidKiosk.startBluetoothServer();
    }

    async function initDevice() {
      // Generar PIN único (solo si no existe en localStorage)
      let deviceId = localStorage.getItem('device_id');
      if (!deviceId) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const newPin = Array.from({ length: 6 }).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
        deviceId = newPin;
        localStorage.setItem('device_id', deviceId);
      }
      
      try {
        // Revisar si existe en la base de datos
        const { data: existing } = await supabase.from('display_devices')
          .select('device_id')
          .eq('device_id', deviceId)
          .maybeSingle();

        if (!existing) {
          // Insert into Supabase
          await supabase.from('display_devices').insert([
            { device_id: deviceId, pairing_status: 'pending' }
          ]).select().single();
        } else {
          // Update last seen if exists
          await supabase.from('display_devices')
            .update({ last_seen: new Date().toISOString() })
            .eq('device_id', deviceId);
        }
        
        setPin(deviceId);
        
        // Check if already active
        const { data } = await supabase.from('display_devices')
          .select('pairing_status')
          .eq('device_id', deviceId)
          .single();
          
        if (data && data.pairing_status === 'linked') {
          navigate(`/tv/${deviceId}`);
          return;
        }
        
        // Subscribe to real-time changes
        const subscription = supabase
          .channel('public:display_devices')
          .on('postgres_changes', { 
              event: 'UPDATE', 
              schema: 'public', 
              table: 'display_devices',
              filter: `device_id=eq.${deviceId}`
            }, 
            (payload) => {
              if (payload.new.pairing_status === 'linked') {
                subscription.unsubscribe();
                navigate(`/tv/${deviceId}`);
              }
            }
          )
          .subscribe();
          
        // Polling de respaldo cada 10 segundos para cuidar CPU
        const pollInterval = setInterval(async () => {
          try {
            const { data } = await supabase.from('display_devices')
              .select('pairing_status')
              .eq('device_id', deviceId)
              .single();
            if (data && data.pairing_status === 'linked') {
              clearInterval(pollInterval);
              subscription.unsubscribe();
              navigate(`/tv/${deviceId}`);
            }
          } catch(e) {}
        }, 10000);

        return () => {
          subscription.unsubscribe();
          clearInterval(pollInterval);
        };
      } catch (error) {
        console.log("Offline or network error, checking for cached data...");
        // Si no hay internet, pero ya tenemos contenido offline, vamos directo al reproductor
        const cachedData = localStorage.getItem(`tv_cache_${deviceId}`);
        if (cachedData) {
          navigate(`/tv/${deviceId}`);
        } else {
          setPin(deviceId); // Show PIN just in case it's a first run with flaky network
        }
      }
    }
    
    initDevice();

    let backPressCount = 0;
    let lastPressTime = 0;

    const registerBackAction = () => {
        const now = Date.now();
        if (now - lastPressTime > 1500) {
            backPressCount = 1;
        } else {
            backPressCount++;
        }
        lastPressTime = now;

        if (backPressCount >= 5) {
            backPressCount = 0;
            if ((window as any).AndroidKiosk?.openSettings) {
                (window as any).AndroidKiosk.openSettings();
            }
        }
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack' || e.key === 'BrowserBack' || e.keyCode === 4) {
            e.preventDefault();
            registerBackAction();
        }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);

    let appListenerPromise = import('@capacitor/app').then(({ App }) => {
        return App.addListener('backButton', () => {
            registerBackAction();
        });
    }).catch(console.error);

    return () => {
        window.removeEventListener('keydown', handleGlobalKeyDown);
        appListenerPromise?.then(listener => listener?.remove?.());
        if ((window as any).AndroidKiosk?.stopBluetoothServer) {
          (window as any).AndroidKiosk.stopBluetoothServer();
        }
    };
  }, [navigate]);


  return (
    <div className="fixed inset-0 w-full h-full bg-gradient-to-br from-zinc-900 via-black to-zinc-900 flex flex-col items-center justify-center font-sans text-white p-8 select-none">
      
      {/* Brand Header */}
      <div className="absolute top-10 left-12 flex items-center gap-3">
        <div className="w-4 h-4 rounded-full bg-cyan-400 animate-pulse"></div>
        <span className="text-xl font-bold tracking-wider text-zinc-300">EVENTPIX <span className="text-cyan-400">TV</span></span>
      </div>

      <div className="w-full max-w-xl flex flex-col items-center bg-zinc-900/80 backdrop-blur-xl p-10 rounded-3xl border border-zinc-800 shadow-2xl text-center gap-6">
        
        <div>
          <span className="text-xs uppercase tracking-widest text-cyan-400 font-semibold">Vincular Pantalla</span>
          <h1 className="text-3xl font-extrabold text-white mt-1">Código de Dispositivo</h1>
        </div>

        <div className="bg-black/60 border border-cyan-500/40 rounded-2xl p-6 w-full text-center shadow-inner">
          <span className="text-6xl font-mono font-bold tracking-widest text-cyan-400">
            {pin || '------'}
          </span>
        </div>

        <div className="space-y-2 text-sm text-zinc-400">
          <div className="flex items-center justify-center gap-2">
            <Bluetooth className="w-5 h-5 text-blue-400 shrink-0" />
            <span>Dispositivo Bluetooth: <strong className="text-white font-mono">EventPix-TV-{pin}</strong></span>
          </div>
          <p className="text-xs text-zinc-500">
            Conéctate desde la App Móvil para enviar Wi-Fi y vincular automáticamente.
          </p>
        </div>

        <div className="w-full grid grid-cols-2 gap-3 mt-2">
          <button
            onClick={() => {
              if ((window as any).AndroidKiosk?.openWifiSettings) {
                (window as any).AndroidKiosk.openWifiSettings();
              } else if ((window as any).AndroidKiosk?.openSettings) {
                (window as any).AndroidKiosk.openSettings();
              }
            }}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-300 text-xs font-medium transition-all border border-zinc-700/50"
          >
            <Wifi className="w-4 h-4 text-cyan-400" />
            <span>Ajustes Wi-Fi</span>
          </button>

          <button
            onClick={() => {
              if ((window as any).AndroidKiosk?.openHomeSettings) {
                (window as any).AndroidKiosk.openHomeSettings();
              } else if ((window as any).AndroidKiosk?.openSettings) {
                (window as any).AndroidKiosk.openSettings();
              } else {
                import('@capacitor/app').then(({ App }) => App.exitApp()).catch(console.error);
              }
            }}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-950/60 hover:bg-red-900/60 active:scale-95 text-red-300 text-xs font-medium transition-all border border-red-800/50"
          >
            <Power className="w-4 h-4 text-red-400" />
            <span>Salir / Launcher</span>
          </button>
        </div>

      </div>

      <div className="absolute bottom-6 text-xs text-zinc-500 font-mono">
        Presiona 5 veces la tecla ATRÁS en el control remoto para acceder a Ajustes
      </div>

    </div>
  );
}
