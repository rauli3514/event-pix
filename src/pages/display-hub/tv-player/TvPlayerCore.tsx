import { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { TvSettingsMenu } from '@/components/display/TvSettingsMenu';
import { useTelemetry } from './useTelemetry';
import { useSyncEngine } from './useSyncEngine';
import { MediaRenderer } from './MediaRenderer';

// --- Master Watchdog Error Boundary ---
class WatchdogBoundary extends Component<{children: ReactNode}, {hasError: boolean}> {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("Watchdog caught critical failure:", error, info);
        // Intentar recuperar el sistema recargando después de 5 segundos
        setTimeout(() => {
            window.location.reload();
        }, 5000);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-zinc-500 font-sans">
                    <p className="text-2xl mb-4">Recuperando sistema...</p>
                    <div className="w-8 h-8 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin"></div>
                </div>
            );
        }
        return this.props.children;
    }
}

// --- Core Player Component ---
const TvPlayerCore = () => {
    const { deviceCode } = useParams<{ deviceCode: string }>();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [localRotation, setLocalRotation] = useState<number | null>(null);
    const rotationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // 1. Telemetry Engine
    const { sendHeartbeat } = useTelemetry(deviceCode);

    // 2. Sync Engine (WebSockets + Polling fallback)
    const {
        items,
        status,
        setStatus,
        deviceSettings,
        deviceName,
        deviceCommerceId,
        preloadProgress,
        fetchCampaign
    } = useSyncEngine(deviceCode, sendHeartbeat);

    // 3. System Events (Rotation, Online status & Secret Exit)
    useEffect(() => {
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

        // Listener nativo de Capacitor para capturar el botón BACK de Android sin cerrar la App
        let appListenerPromise = import('@capacitor/app').then(({ App }) => {
            return App.addListener('backButton', () => {
                registerBackAction();
            });
        }).catch(console.error);

        const storedRotation = localStorage.getItem('local_rotation');
        if (storedRotation !== null) {
            setLocalRotation(parseInt(storedRotation, 10));
        }

        const handleRotationChange = (e: any) => {
            setLocalRotation(e.detail);
        };
        window.addEventListener('local_rotation_changed', handleRotationChange);

        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown);
            window.removeEventListener('local_rotation_changed', handleRotationChange);
            appListenerPromise?.then(listener => listener?.remove?.());
        };
    }, []);

    // 4. Media Rotation Logic
    useEffect(() => {
        if (items.length === 0 || (status !== 'playing' && status !== 'offline_playing')) return;

        if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current);

        const currentItem = items[currentIndex];
        if (!currentItem) {
            setCurrentIndex(0);
            return;
        }
        
        const durationMs = (currentItem.duration && currentItem.duration > 0 ? currentItem.duration : 10) * 1000;

        rotationTimeoutRef.current = setTimeout(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % items.length);
        }, durationMs);

        return () => {
            if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current);
        };
    }, [currentIndex, items, status]);


    // --- UI Renders ---
    
    const getRotationStyle = (orientation: string | undefined): React.CSSProperties => {
        let degreeStr = localRotation !== null ? String(localRotation) : (orientation || '0');
        if (degreeStr === 'portrait') degreeStr = '90';
        if (degreeStr === 'landscape') degreeStr = '0';
        
        const degree = parseInt(degreeStr, 10) || 0;

        if (degree === 90 || degree === 270) {
            return {
                position: 'fixed',
                transform: `rotate(${degree}deg)`,
                transformOrigin: 'center center',
                width: '100vh',
                height: '100vw',
                top: 'calc(50vh - 50vw)',
                left: 'calc(50vw - 50vh)',
                backgroundColor: '#111',
                overflow: 'hidden'
            };
        } else if (degree === 180) {
            return {
                position: 'fixed',
                transform: 'rotate(180deg)',
                transformOrigin: 'center center',
                width: '100vw',
                height: '100vh',
                top: 0,
                left: 0,
                backgroundColor: '#111',
                overflow: 'hidden'
            };
        }

        return {
            position: 'fixed',
            transform: 'none',
            width: '100vw',
            height: '100vh',
            top: 0,
            left: 0,
            backgroundColor: '#111',
            overflow: 'hidden'
        };
    };

    const containerStyle = getRotationStyle(deviceSettings.orientation);

    if (status === 'loading') {
        return (
            <div className="fixed inset-0 w-full h-full bg-[#111] flex flex-col items-center justify-center font-sans">
                {preloadProgress && (
                    <div className="absolute bottom-12 w-[600px] max-w-[80vw]">
                        <div className="text-[1.2vw] text-zinc-400 mb-2 font-light">
                            Descargando {preloadProgress.current} de {preloadProgress.total} activos
                        </div>
                        <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-[#3b82f6] transition-all duration-300"
                                style={{ width: `${(preloadProgress.current / preloadProgress.total) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (status === 'no_content') {
        return (
            <div className="fixed inset-0 w-full h-full bg-[#333333] flex flex-col items-center justify-center font-sans">
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-[14vw] font-light tracking-wide text-[#00C4CC] drop-shadow-sm">Paired</p>
                </div>
                <div className="mb-16 text-center">
                    <p className="text-[2.5vw] text-white mb-2 tracking-wide font-light">app.event-pix.com.ar</p>
                    <p className="text-[1.5vw] text-zinc-400 font-light tracking-wide">para asignar contenido • Pantalla: {deviceName || deviceCode}</p>
                </div>
                <TvSettingsMenu deviceCode={deviceCode!} onRefresh={() => fetchCampaign()} />
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="fixed inset-0 w-full h-full bg-[#111] flex flex-col items-center justify-center text-white">
                <div className="text-4xl font-bold text-rose-500 mb-4">Error de Conexión</div>
                <div className="text-lg text-zinc-500 mb-8">Revisando red...</div>
                <button 
                    onClick={() => { setStatus('loading'); fetchCampaign(); }}
                    className="px-6 py-2 bg-zinc-800 text-white rounded-md hover:bg-zinc-700"
                >
                    Reintentar
                </button>
                <TvSettingsMenu deviceCode={deviceCode!} onRefresh={() => fetchCampaign()} />
            </div>
        );
    }

    return (
        <div style={containerStyle}>
            <MediaRenderer 
                items={items} 
                currentIndex={currentIndex} 
                deviceCommerceId={deviceCommerceId} 
            />
            <TvSettingsMenu deviceCode={deviceCode!} onRefresh={() => fetchCampaign()} />
        </div>
    );
};

export default function TvPlayer() {
    return (
        <WatchdogBoundary>
            <TvPlayerCore />
        </WatchdogBoundary>
    );
}
