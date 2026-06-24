import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { MonitorPlay } from 'lucide-react';

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
        const { data } = await supabase.from('display_devices')
          .select('pairing_status')
          .eq('device_id', deviceId)
          .single();
        if (data && data.pairing_status === 'linked') {
          clearInterval(pollInterval);
          subscription.unsubscribe();
          navigate(`/tv/${deviceId}`);
        }
      }, 5000);

      return () => {
        subscription.unsubscribe();
        clearInterval(pollInterval);
      };
    }
    
    initDevice();
  }, [navigate]);

  return (
    <div className="fixed inset-0 w-full h-full bg-black text-white p-8 flex flex-col items-center justify-center">
      <div className="bg-zinc-900/80 border border-zinc-800 p-12 rounded-3xl text-center shadow-2xl max-w-lg w-full backdrop-blur-md">
        <MonitorPlay className="w-16 h-16 text-indigo-500 mx-auto mb-6" />
        <h1 className="text-4xl font-bold mb-4">EventPix TV</h1>
        <p className="text-zinc-400 mb-8 text-lg">Para vincular esta pantalla, ingresa el siguiente código en tu panel de control:</p>
        
        <div className="bg-zinc-950 px-10 py-6 rounded-2xl border border-zinc-800 inline-block">
          <p className="text-6xl font-mono tracking-widest text-[#00E5FF] font-bold">
            {pin || '------'}
          </p>
        </div>
        
        <div className="mt-12 flex items-center justify-center space-x-3 text-zinc-500">
          <div className="w-4 h-4 rounded-full border-2 border-t-[#00E5FF] animate-spin"></div>
          <p>Esperando enlace...</p>
        </div>
      </div>
    </div>
  );
}
