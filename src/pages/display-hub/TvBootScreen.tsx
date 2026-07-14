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
  }, [navigate]);

  return (
    <div className="fixed inset-0 w-full h-full bg-[#333333] flex flex-col items-center justify-center font-sans">
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[12vw] font-light tracking-widest text-[#00C4CC] drop-shadow-sm">
          {pin || '------'}
        </p>
      </div>
      
      <div className="mb-16 text-center">
        <p className="text-[2.5vw] text-white mb-2 tracking-wide font-light">app.event-pix.com.ar/usuarios</p>
        <p className="text-[1.5vw] text-zinc-400 font-light tracking-wide">para aparejar esta pantalla y comenzar a usarla</p>
      </div>
    </div>
  );
}
