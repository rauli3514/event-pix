import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, RefreshCw, Unlink, Trash2, X, Info, Power, Monitor, Clock, ShieldCheck, Zap } from 'lucide-react';

import { callTvBridge, exitAndroidApp, getTvAppVersion, hasTvBridgeMethod, onTvBridgeReady, openHomeSettings, openWifiSettings } from '@/lib/tvBridge';
import { checkTvUpdate, startTvUpdate, supportsTvUpdate, TvUpdateStatus, useTvUpdateStatus } from '@/lib/tvUpdate';
import { LiteSetting, setLiteSetting, useLiteMode } from '@/lib/tvPerformance';

// Texto de la opción "Modo liviano": qué está elegido y si está activo ahora.
function liteLabel(setting: LiteSetting, lite: boolean, memoryMb: number | null): string {
    if (setting === 'on') return 'Modo liviano: ON';
    if (setting === 'off') return 'Modo liviano: OFF';
    const ram = memoryMb ? `, ${Math.round(memoryMb)} MB de RAM` : '';
    return `Modo liviano: AUTO (${lite ? 'activo' : 'inactivo'}${ram})`;
}
const NEXT_LITE: Record<LiteSetting, LiteSetting> = { auto: 'on', on: 'off', off: 'auto' };

// Texto y acción de la opción "Actualizar app" según el estado que informa la app.
function updateMenuItem(status: TvUpdateStatus): { label: string; action: () => void } {
    const current = status.current?.name ? ` (v${status.current.name})` : '';
    switch (status.state) {
        case 'available':
            return { label: `Actualizar app a v${status.latest?.name ?? ''}`, action: startTvUpdate };
        case 'downloading':
            return { label: `Descargando actualización… ${status.progress ?? 0}%`, action: () => {} };
        case 'installing':
        case 'confirm':
            return { label: 'Confirmá la instalación en pantalla', action: () => {} };
        case 'up_to_date':
            return { label: `App al día${current}`, action: checkTvUpdate };
        case 'error':
            return { label: 'Actualización: error, reintentar', action: checkTvUpdate };
        default:
            return { label: 'Buscando actualización…', action: checkTvUpdate };
    }
}

interface TvSettingsMenuProps {
    deviceCode: string;
    onRefresh: () => void;
}

export const TvSettingsMenu = ({ deviceCode, onRefresh }: TvSettingsMenuProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const navigate = useNavigate();

    // Hardware Settings State
    const [autoBoot, setAutoBoot] = useState(true);
    const [watchdog, setWatchdog] = useState(true);
    const [keepAwake, setKeepAwake] = useState(true);
    const [localRotation, setLocalRotation] = useState<number>(0);
    const [rebootHour, setRebootHour] = useState(3);
    // null = esta app no maneja el permiso (navegador, kiosco o Android viejo).
    const [canAutoStart, setCanAutoStart] = useState<boolean | null>(null);
    const updateStatus = useTvUpdateStatus();
    const liteMode = useLiteMode();
    const [canUpdate, setCanUpdate] = useState(false);

    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    useEffect(() => {
        let cancelBridge = () => {};
        if (isOpen) {
            cancelBridge = onTvBridgeReady(() => {
                setAutoBoot(callTvBridge<boolean>('getAutoBoot') ?? true);
                setWatchdog(callTvBridge<boolean>('getWatchdog') ?? true);
                setKeepAwake(callTvBridge<boolean>('getKeepAwake') ?? true);
                setRebootHour(callTvBridge<number>('getRebootHour') ?? 3);
                setCanAutoStart(hasTvBridgeMethod('canAutoStart') ? !!callTvBridge<boolean>('canAutoStart') : null);
                // Al abrir el menú se busca si hay una versión nueva de la app.
                setCanUpdate(supportsTvUpdate());
                if (supportsTvUpdate()) checkTvUpdate();
                callTvBridge('setOrientation', true); // Force hardware to landscape
            });
        }
        
        const stored = localStorage.getItem('local_rotation');
        if (stored !== null) {
            setLocalRotation(parseInt(stored, 10));
        }
        return cancelBridge;
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && itemRefs.current[selectedIndex]) {
            itemRefs.current[selectedIndex]?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    }, [selectedIndex, isOpen]);

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
        ...(canUpdate ? [{
            id: 'app_update',
            ...updateMenuItem(updateStatus),
            icon: <RefreshCw className={`w-5 h-5 ${updateStatus.state === 'available' ? 'text-orange-400' : ''}`} />,
        }] : []),
        {
            id: 'autoboot',
            label: `Inicio Automático: ${autoBoot ? 'ON' : 'OFF'}`,
            icon: <Power className="w-5 h-5" />,
            action: () => {
                const newVal = !autoBoot;
                setAutoBoot(newVal);
                callTvBridge('setAutoBoot', newVal);
            }
        },
        // Android 10+: sin el permiso "mostrar sobre otras apps", la app no puede
        // abrirse sola al prender el equipo (salvo que sea el launcher).
        ...(canAutoStart === null ? [] : [{
            id: 'autostart_permission',
            label: canAutoStart ? 'Arranque automático: permitido ✓' : 'Arranque automático: falta permiso (activar)',
            icon: <ShieldCheck className={`w-5 h-5 ${canAutoStart ? 'text-emerald-400' : 'text-amber-400'}`} />,
            action: () => {
                callTvBridge('openAutoStartSettings');
                setIsOpen(false);
            }
        }]),
        {
            id: 'watchdog',
            label: `Reinicio ante fallos: ${watchdog ? 'ON' : 'OFF'}`,
            icon: <ShieldCheck className="w-5 h-5" />,
            action: () => {
                const newVal = !watchdog;
                setWatchdog(newVal);
                callTvBridge('setWatchdog', newVal);
            }
        },
        {
            // Equipos con poca memoria: menos contenido cargado a la vez y
            // transiciones simples (ver tvPerformance.ts).
            id: 'lite_mode',
            label: liteLabel(liteMode.setting, liteMode.lite, liteMode.memoryMb),
            icon: <Zap className={`w-5 h-5 ${liteMode.lite ? 'text-emerald-400' : ''}`} />,
            action: () => setLiteSetting(NEXT_LITE[liteMode.setting])
        },
        {
            id: 'keepawake',
            label: `Mantener Despierto: ${keepAwake ? 'ON' : 'OFF'}`,
            icon: <Zap className="w-5 h-5" />,
            action: () => {
                const newVal = !keepAwake;
                setKeepAwake(newVal);
                callTvBridge('setKeepAwake', newVal);
            }
        },
        {
            id: 'orientation',
            label: `Rotación: ${localRotation}°`,
            icon: <Monitor className="w-5 h-5" />,
            action: () => {
                const nextRotation = (localRotation + 90) % 360;
                setLocalRotation(nextRotation);
                localStorage.setItem('local_rotation', String(nextRotation));
                window.dispatchEvent(new CustomEvent('local_rotation_changed', { detail: nextRotation }));
                callTvBridge('setOrientation', true); // Force hardware to landscape
            }
        },
        {
            id: 'reboot',
            label: `Reinicio Diario: ${String(rebootHour).padStart(2, '0')}:00`,
            icon: <Clock className="w-5 h-5" />,
            action: () => {
                const nextHour = (rebootHour + 1) % 24;
                setRebootHour(nextHour);
                callTvBridge('scheduleDailyRestart', nextHour, 0);
            }
        },
        {
            id: 'clear_cache',
            label: 'Limpiar Caché',
            icon: <Trash2 className="w-5 h-5" />,
            action: () => {
                // Mismas claves que usa el reproductor (useSyncEngine).
                [`tv_cache_${deviceCode}_v3`, `tv_assignment_${deviceCode}_v1`, `tv_cache_${deviceCode}_v2`, `tv_cache_${deviceCode}`]
                    .forEach(key => localStorage.removeItem(key));
                window.location.reload();
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
                alert(`Device ID: ${deviceCode}\nApp TV: ${getTvAppVersion() ?? 'no disponible'}\nResolución: ${window.innerWidth}x${window.innerHeight}\nModo liviano: ${liteMode.lite ? 'activo' : 'inactivo'}${liteMode.memoryMb ? ` (RAM ${Math.round(liteMode.memoryMb)} MB)` : ''}`);
            }
        },
        {
            id: 'wifi_settings',
            label: 'Configurar Wi-Fi (Android)',
            icon: <Zap className="w-5 h-5 text-cyan-400" />,
            action: () => {
                if (!openWifiSettings()) alert('Solo disponible en Android.');
            }
        },
        {
            id: 'home_settings',
            label: 'Cambiar Launcher / Salir a Android',
            icon: <Power className="w-5 h-5 text-amber-400" />,
            action: () => {
                if (!openHomeSettings()) alert('Solo disponible en Android.');
            }
        },
        {
            id: 'exit',
            label: 'Salir de la App',
            icon: <Power className="w-5 h-5 text-red-500" />,
            action: () => {
                if (!exitAndroidApp()) {
                    import('@capacitor/app').then(({ App }) => {
                        App.exitApp();
                    }).catch(() => {
                        window.close();
                    });
                }
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
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev + 1) % menuItems.length);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev - 1 + menuItems.length) % menuItems.length);
                } else if (e.key === 'Enter') {
                    e.preventDefault(); // Evitar que el navegador dispare un 'click' adicional en el botón
                    menuItems[selectedIndex].action();
                } else if (e.key === 'Escape' || e.key === 'Backspace') {
                    e.preventDefault();
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
                    <img src="/edm-assets/logo.PNG" alt="EventPix" className="h-12 mb-4 object-contain" />
                    <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-3">
                        Display Digital by eventpix
                    </h2>
                    <p className="text-zinc-400 font-mono text-sm">ID: {deviceCode}</p>
                </div>

                <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
                    {menuItems.map((item, index) => {
                        const isSelected = index === selectedIndex;
                        return (
                            <button
                                key={item.id}
                                ref={(el) => { itemRefs.current[index] = el; }}
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
