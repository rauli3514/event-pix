import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VirtualKeyboard } from '@/components/ui/VirtualKeyboard';
// La librería de exportación se carga dinámicamente vía CDN para evitar el problema de npm

interface StickerEditorProps {
  userPhotoUrl: string | null;
  countryFolder?: string;
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}

export function StickerEditor({ userPhotoUrl, countryFolder = 'argentina', onSave, onCancel }: StickerEditorProps) {
  const stickerRef = useRef<HTMLDivElement>(null);
  const nameContainerRef = useRef<HTMLDivElement>(null);
  const nameTextRef = useRef<HTMLHeadingElement>(null);
  
  // States
  const [position, setPosition] = useState('delantero');
  const [name, setName] = useState('');
  const [nameScale, setNameScale] = useState(1);
  const [birthDate, setBirthDate] = useState(''); // YYYY-MM-DD format
  const [height, setHeight] = useState('1.75');
  const [weight, setWeight] = useState('70');
  const [club, setClub] = useState('');
  
  const [activeKeyboard, setActiveKeyboard] = useState<'name' | 'club' | null>(null);
  const [photoScale, setPhotoScale] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);

  const getFrameUrl = () => {
    switch(position) {
      case 'arquero': return `/figuritas/${countryFolder}/arquero.png`;
      case 'defensor': return `/figuritas/${countryFolder}/defensor.png`;
      case 'delantero': return `/figuritas/${countryFolder}/delantero.png`;
      case 'mediocampista': return `/figuritas/${countryFolder}/mediocampista.png`;
      case 'dorada': return `/figuritas/${countryFolder}/dorada.png`;
      default: return `/figuritas/${countryFolder}/arquero.png`;
    }
  };

  // Cargar html-to-image dinámicamente
  useEffect(() => {
    if (!document.getElementById('html-to-image-script')) {
      const script = document.createElement('script');
      script.id = 'html-to-image-script';
      script.src = "https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js";
      document.head.appendChild(script);
    }
  }, []);

  const handleExport = async () => {
    if (!stickerRef.current) return;
    try {
      setIsGenerating(true);
      // @ts-ignore
      if (window.htmlToImage) {
        // @ts-ignore
        const dataUrl = await window.htmlToImage.toPng(stickerRef.current, {
          quality: 0.95,
          pixelRatio: 2
        });
        onSave(dataUrl);
      } else {
        alert("La herramienta de guardado está cargando, intenta en un par de segundos...");
        setIsGenerating(false);
      }
    } catch (err) {
      console.error('Error generating sticker:', err);
      alert('Error al generar la figurita. Intenta nuevamente.');
      setIsGenerating(false);
    }
  };

  // Efecto para auto-escalar el nombre si es muy largo
  useEffect(() => {
    if (nameContainerRef.current && nameTextRef.current) {
      setNameScale(1); // Reset primero
      const timer = setTimeout(() => {
        if (nameContainerRef.current && nameTextRef.current) {
          const containerWidth = nameContainerRef.current.clientWidth;
          const textWidth = nameTextRef.current.scrollWidth;
          if (textWidth > containerWidth) {
            // Escalar hacia abajo dejando un margen de 10px
            setNameScale((containerWidth - 10) / textWidth);
          }
        }
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [name]);

  return (
    <div className="flex flex-col md:flex-row gap-8 w-full max-w-6xl mx-auto p-4">
      {/* Panel Izquierdo: Editor Visual */}
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-900/50 p-8 rounded-xl border border-white/10">
        <div 
          ref={stickerRef}
          className="relative overflow-hidden shadow-2xl"
          style={{ width: '400px', height: '560px', backgroundColor: '#fff' }}
        >
          {/* Capa 1: Fondo Base y Marco PNG (El fondo principal) */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-black z-0" />
          <img 
            src={getFrameUrl()} 
            className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none"
            alt="Marco de Figurita"
          />
          
          {/* Capa 2: Foto del Usuario (Enmascarada pero manteniendo la foto completa) */}
          <div 
            className="absolute z-20 overflow-hidden"
            style={{ top: '24px', bottom: '118px', left: '22px', right: '110px' }}
          >
            {userPhotoUrl && (
              <motion.img 
                drag 
                src={userPhotoUrl} 
                className="absolute top-0 left-[-10%] w-[120%] h-auto object-contain origin-center cursor-move"
                animate={{ scale: photoScale }}
                alt="User photo" 
              />
            )}
          </div>

          {/* Capa 3: Textos Superpuestos (Nombre, stats, etc - Siempre arriba de la foto) */}
          <div className="absolute inset-0 z-30 pointer-events-none font-modern">
            
            {/* Nombre (Auto-escalable para que no salga de la caja) */}
            <div 
              ref={nameContainerRef}
              className="absolute flex justify-center items-center" 
              style={{ bottom: '78px', left: '6%', width: '68%' }}
            >
              <h2 
                ref={nameTextRef}
                className="text-[21px] font-black text-white uppercase tracking-widest leading-none whitespace-nowrap origin-center transition-transform"
                style={{ transform: `scale(${nameScale})` }}
              >
                {name || 'NOMBRE'}
              </h2>
            </div>

            {/* Estadísticas con fondo para tapar el texto de abajo */}
            <div className="absolute flex justify-center items-center gap-2 text-white text-[11px] font-bold uppercase tracking-wider bg-black/25 backdrop-blur-md rounded-full py-1" style={{ bottom: '50px', left: '14%', width: '52%' }}>
              <span>{birthDate ? birthDate.split('-').reverse().join('/') : 'DD/MM/AAAA'}</span>
              <span className="text-white/60 font-normal">|</span>
              <span>{height ? `${height} m` : '-'}</span>
              <span className="text-white/60 font-normal">|</span>
              <span>{weight ? `${weight} kg` : '-'}</span>
            </div>

            {/* Club (Centrado en su caja pequeña) */}
            <div className="absolute flex justify-center items-center" style={{ bottom: '24px', left: '6%', width: '68%' }}>
              <p className="text-white text-[13px] font-black tracking-widest uppercase">
                {club || 'TU CLUB'}
              </p>
            </div>
          </div>
        </div>

        {/* Controles rápidos de la foto */}
        {userPhotoUrl && (
          <div className="mt-6 w-full max-w-[400px]">
            <Label className="text-white/70 mb-2 block">Tamaño de la foto</Label>
            <input 
              type="range" 
              min="0.5" max="5" step="0.05" 
              value={photoScale} 
              onChange={(e) => setPhotoScale(parseFloat(e.target.value))}
              className="w-full accent-blue-500 h-4 bg-white/10 rounded-lg"
            />
          </div>
        )}
      </div>

      {/* Panel Derecho: Controles y Datos */}
      <div className="w-full md:w-[400px] flex flex-col gap-6 bg-zinc-900/80 p-6 rounded-xl border border-white/10">
        <div>
          <h3 className="text-xl font-bold text-white mb-4">Personaliza tu Figurita</h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white/80">Posición / Marco</Label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger className="bg-black/50 border-white/20 text-white">
                  <SelectValue placeholder="Selecciona una posición" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 text-white border-white/20">
                  <SelectItem value="arquero">Arquero</SelectItem>
                  <SelectItem value="defensor">Defensor</SelectItem>
                  <SelectItem value="mediocampista">Mediocampista</SelectItem>
                  <SelectItem value="delantero">Delantero</SelectItem>
                  <SelectItem value="dorada">Dorada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">Nombre en Tarjeta</Label>
              <Input 
                value={name} 
                readOnly
                onClick={() => setActiveKeyboard('name')}
                placeholder="Escribe tu nombre (Toca aquí)"
                className="bg-black/50 border-white/20 text-white uppercase placeholder:text-white/30 cursor-pointer caret-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white/80">Nacimiento</Label>
                <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="bg-black/50 border-white/20 text-white [color-scheme:dark]" />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Club</Label>
                <Input 
                  value={club} 
                  readOnly
                  onClick={() => setActiveKeyboard('club')}
                  placeholder="Ej: River Plate" 
                  className="bg-black/50 border-white/20 text-white placeholder:text-white/30 cursor-pointer caret-transparent" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white/80">Altura</Label>
                <Select value={height} onValueChange={setHeight}>
                  <SelectTrigger className="bg-black/50 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 text-white border-white/20">
                    {Array.from({ length: 17 }, (_, i) => (1.50 + i * 0.05).toFixed(2)).map(h => (
                      <SelectItem key={h} value={h}>{h} m</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Peso</Label>
                <Select value={weight} onValueChange={setWeight}>
                  <SelectTrigger className="bg-black/50 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 text-white border-white/20">
                    {Array.from({ length: 15 }, (_, i) => String(50 + i * 5)).map(w => (
                      <SelectItem key={w} value={w}>{w} kg</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto flex gap-4 pt-6 border-t border-white/10">
          <Button variant="ghost" onClick={onCancel} className="flex-1 text-white/70 hover:text-white hover:bg-white/10">
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={isGenerating} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold">
            {isGenerating ? 'Generando...' : 'Generar Figurita'}
          </Button>
        </div>
      </div>

      {/* TECLADO EN PANTALLA (Kiosco Táctil) */}
      {activeKeyboard === 'name' && (
        <VirtualKeyboard 
          value={name} 
          onChange={(val) => setName(val.toUpperCase())} 
          onClose={() => setActiveKeyboard(null)} 
        />
      )}
      {activeKeyboard === 'club' && (
        <VirtualKeyboard 
          value={club} 
          onChange={(val) => setClub(val.toUpperCase())} 
          onClose={() => setActiveKeyboard(null)} 
        />
      )}
    </div>
  );
}
