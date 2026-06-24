import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, RefreshCw, Unlink, Trash2, X, Info } from 'lucide-react';

interface TvSettingsMenuProps {
    deviceCode: string;
    onRefresh: () => void;
}

export const TvSettingsMenu = ({ deviceCode, onRefresh }: TvSettingsMenuProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const navigate = useNavigate();

    const menuItems = [
        {
            id: 'refresh',
            label: 'Forzar Actualización',
            icon: <RefreshCw className="w-5 h-5" />,
            action: () => {
                onRefresh();
                setIsOpen(false);
            }
        },
        {
            id: 'clear_cache',
            label: 'Limpiar Caché',
            icon: <Trash2 className="w-5 h-5" />,
            action: () => {
                localStorage.removeItem(`tv_cache_${deviceCode}`);
                onRefresh();
                setIsOpen(false);
            }
        },
        {
            id: 'unpair',
            label: 'Desvincular Pantalla',
            icon: <Unlink className="w-5 h-5" />,
            action: () => {
                if (window.confirm('¿Seguro que deseas desvincular esta pantalla?')) {
                    localStorage.removeItem('device_id');
                    navigate('/');
                }
            }
        },
        {
            id: 'info',
            label: 'Información del Sistema',
            icon: <Info className="w-5 h-5" />,
            action: () => {
                alert(`Device ID: ${deviceCode}\nVersión: 2.0.1 (Web)\nResolución: ${window.innerWidth}x${window.innerHeight}`);
            }
        },
        {
            id: 'close',
            label: 'Cerrar Menú',
            icon: <X className="w-5 h-5" />,
            action: () => setIsOpen(false)
        }
    ];

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Teclas para ABRIR el menú (Enter, OK del control, M, Esc)
            if (!isOpen && (e.key === 'Enter' || e.key === 'm' || e.key === 'M' || e.key === 'Escape')) {
                setIsOpen(true);
                setSelectedIndex(0);
                return;
            }

            if (isOpen) {
                if (e.key === 'ArrowDown') {
                    setSelectedIndex((prev) => (prev + 1) % menuItems.length);
                } else if (e.key === 'ArrowUp') {
                    setSelectedIndex((prev) => (prev - 1 + menuItems.length) % menuItems.length);
                } else if (e.key === 'Enter') {
                    menuItems[selectedIndex].action();
                } else if (e.key === 'Escape' || e.key === 'Backspace') {
                    setIsOpen(false);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, selectedIndex, menuItems]);

    if (!isOpen) {
        // Un botón invisible en la esquina para abrir con mouse/touch
        return (
            <div 
                className="absolute top-0 right-0 w-16 h-16 z-50 cursor-pointer opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
                onClick={() => setIsOpen(true)}
                onDoubleClick={() => setIsOpen(true)}
            >
                <Settings className="w-8 h-8 text-white drop-shadow-md" />
            </div>
        );
    }

    return (
        <div className="absolute inset-0 z-50 flex">
            {/* Sidebar oscura */}
            <div className="w-96 h-full bg-zinc-950/95 backdrop-blur-xl border-r border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
                <div className="p-8 border-b border-zinc-800/50">
                    <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <Settings className="text-indigo-500" /> EventPix TV
                    </h2>
                    <p className="text-zinc-400 font-mono text-sm">ID: {deviceCode}</p>
                </div>

                <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
                    {menuItems.map((item, index) => {
                        const isSelected = index === selectedIndex;
                        return (
                            <button
                                key={item.id}
                                onClick={item.action}
                                onMouseEnter={() => setSelectedIndex(index)}
                                className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl text-left transition-all duration-200 ${
                                    isSelected 
                                        ? 'bg-indigo-600 text-white shadow-lg scale-[1.02]' 
                                        : 'text-zinc-300 hover:bg-zinc-800/50'
                                }`}
                            >
                                <span className={isSelected ? 'text-white' : 'text-zinc-500'}>
                                    {item.icon}
                                </span>
                                <span className="text-lg font-medium">{item.label}</span>
                                
                                {isSelected && (
                                    <span className="ml-auto text-xs bg-indigo-500/50 px-2 py-1 rounded text-indigo-100">
                                        OK
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="p-6 border-t border-zinc-800/50 text-center">
                    <p className="text-zinc-500 text-sm">Usa las flechas y OK para navegar</p>
                </div>
            </div>

            {/* Overlay para cerrar haciendo clic afuera */}
            <div 
                className="flex-1 bg-black/40 backdrop-blur-sm"
                onClick={() => setIsOpen(false)}
            />
        </div>
    );
};
