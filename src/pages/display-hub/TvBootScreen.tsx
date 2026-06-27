import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';


export default function TvBootScreen() {
  const [pin, setPin] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
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
          
        // Polling de respaldo cada 5 segundos
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
        }, 5000);

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
  }, [navigate]);

  return (
    <div 
      className="fixed inset-0 w-full h-full text-white p-8 flex flex-col items-center justify-center bg-black bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: 'url(/edm-assets/fondo.PNG)' }}
    >
      <div className="bg-zinc-900/80 border border-zinc-800 p-12 rounded-3xl text-center shadow-2xl max-w-lg w-full backdrop-blur-md">
        <img src="/edm-assets/logo.PNG" alt="EventPix" className="w-48 mx-auto mb-6 drop-shadow-lg" />
        <p className="text-zinc-300 mb-8 text-lg">Para vincular esta pantalla, ingresa el siguiente código en tu panel de control:</p>
        
        <div className="bg-zinc-950 px-10 py-6 rounded-2xl border border-zinc-800 inline-block shadow-inner">
          <p className="text-6xl font-mono tracking-widest text-[#00E5FF] font-bold">
            {pin || '------'}
          </p>
        </div>
        
        <div className="mt-12 flex items-center justify-center space-x-3 text-zinc-400">
          <div className="w-4 h-4 rounded-full border-2 border-zinc-500 border-t-[#00E5FF] animate-spin"></div>
          <p className="font-medium tracking-wide">Esperando enlace...</p>
        </div>
      </div>
    </div>
  );
}
