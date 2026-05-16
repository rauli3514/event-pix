import { useState } from 'react';
import { Delete } from 'lucide-react';

interface KeyboardProps {
  value: string;
  onChange: (val: string) => void;
  onClose: () => void;
}

export function VirtualKeyboard({ value, onChange, onClose }: KeyboardProps) {
  const [isNumeric, setIsNumeric] = useState(false);

  const letters = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
  ];

  const numbers = [
    ['1', '2', '3', '4', '5'],
    ['6', '7', '8', '9', '0'],
    ['.', '-', '_', '@']
  ];

  const handleKeyPress = (key: string) => {
    onChange(value + key);
  };

  const handleBackspace = () => {
    onChange(value.slice(0, -1));
  };

  const currentLayout = isNumeric ? numbers : letters;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[100] bg-zinc-950/95 backdrop-blur-xl border-t border-white/10 p-4 md:p-8 animate-in slide-in-from-bottom flex flex-col items-center shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
      
      <div className="w-full max-w-4xl flex justify-between items-center mb-6">
         <div className="bg-black/50 border border-white/10 px-6 py-4 rounded-xl flex-1 mr-4 overflow-hidden">
            <span className="text-white text-2xl font-black tracking-widest">{value}<span className="animate-pulse text-blue-500">|</span></span>
         </div>
         <button 
           onClick={onClose} 
           className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xl px-8 py-4 rounded-xl transition-all"
         >
           LISTO
         </button>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-4xl">
        {currentLayout.map((row, i) => (
          <div key={i} className="flex justify-center gap-2 md:gap-3">
            {row.map(key => (
              <button
                key={key}
                onClick={() => handleKeyPress(key)}
                className="h-16 w-10 sm:w-14 md:h-20 md:w-20 bg-zinc-800 hover:bg-zinc-700 active:bg-blue-500 active:scale-95 text-white font-black text-2xl md:text-3xl rounded-xl transition-all shadow-lg border border-white/5 flex items-center justify-center"
              >
                {key}
              </button>
            ))}
          </div>
        ))}
        <div className="flex justify-center gap-2 md:gap-3 mt-2">
          <button
            onClick={() => setIsNumeric(!isNumeric)}
            className="h-16 md:h-20 px-6 md:px-10 bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 text-white font-bold text-xl md:text-2xl rounded-xl transition-all shadow-lg"
          >
            {isNumeric ? 'ABC' : '123'}
          </button>
          <button
            onClick={() => handleKeyPress(' ')}
            className="h-16 md:h-20 flex-1 max-w-[400px] bg-zinc-800 hover:bg-zinc-700 active:bg-blue-500 text-white/30 font-bold text-xl md:text-2xl rounded-xl transition-all shadow-lg border border-white/5"
          >
            ESPACIO
          </button>
          <button
            onClick={handleBackspace}
            className="h-16 md:h-20 px-6 md:px-10 bg-red-900/60 hover:bg-red-800 active:bg-red-600 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center"
          >
            <Delete className="w-8 h-8" />
          </button>
        </div>
      </div>
    </div>
  );
}
