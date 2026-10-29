import { useState, useEffect, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { TvSettingsMenu } from '@/components/display/TvSettingsMenu';
import { useTelemetry } from './useTelemetry';
import { useSyncEngine } from './useSyncEngine';
import { MediaRenderer } from './MediaRenderer';
import { usePlaylistRotation } from '@/hooks/use-playlist-rotation';
import { callTvBridge, hasTvBridgeMethod, onTvBridgeReady } from '@/lib/tvBridge';
import { useLiteMode } from '@/lib/tvPerformance';
import { useLocalDay } from '@/hooks/use-local-day';
import { itemsActiveOn } from '@/lib/playlistItems';

// Identidad de Display Digital para las pantallas de espera de la TV. En la app
// Android el logo sale del APK (WebViewManager intercepta /edm-assets/).
const BRAND_LOGO = '/edm-assets/logo.PNG';
const BRAND_BACKGROUND: React.CSSProperties = {
    // Centro del mismo tono que el fondo del logo (#020f28) para que se funda.
    background: 'radial-gradient(ellipse at center, #031533 0%, #020f28 30%, #01040f 85%)',
};
// El logo trae su propio fondo azul: se difuminan los bordes para que no se vea
// el rectángulo sobre el degradado (-webkit- para WebViews viejos).
const LOGO_FADE = 'radial-gradient(ellipse at center, #000 63%, transparent 73%)';
const BRAND_LOGO_STYLE: React.CSSProperties = { maskImage: LOGO_FADE, WebkitMaskImage: LOGO_FADE };

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
    const [localRotation, setLocalRotation] = useState<number | null>(null);

    // 1. Telemetry Engine
    const { sendHeartbeat } = useTelemetry(deviceCode);

    // 2. Sync Engine (WebSockets + Polling fallback)
    const {
        items: allItems,
        status,
        setStatus,
        deviceSettings,
        deviceName,
        deviceCommerceId,
        preloadProgress,
        fetchCampaign,
        contentKey,
        shuffle
    } = useSyncEngine(deviceCode, sendHeartbeat);

    // Solo lo que está en fecha hoy (los vencidos y los que todavía no
    // empiezan se saltean); se vuelve a calcular a la medianoche.
    const today = useLocalDay();
    const items = useMemo(() => itemsActiveOn(allItems, today), [allItems, today]);
    const nothingToday = allItems.length > 0 && items.length === 0;

    // Modo liviano en equipos con poca memoria (ver tvPerformance.ts).
    const { lite } = useLiteMode();

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

    // Lock native orientation & apply rotation when orientation setting changes from Web Admin
    useEffect(() => {
        let cancelBridge = () => {};
        if (deviceSettings.orientation !== undefined && deviceSettings.orientation !== null) {
            let degreeStr = String(deviceSettings.orientation);
            if (degreeStr === 'portrait') degreeStr = '90';
            if (degreeStr === 'landscape') degreeStr = '0';
            const degree = parseInt(degreeStr, 10) || 0;

            if (hasTvBridgeMethod('setOrientation')) {
                // Con la app nueva el puente recién está listo al terminar de cargar la página.
                cancelBridge = onTvBridgeReady(() => {
                    callTvBridge('setOrientation', degree === 90 || degree === 270 ? false : true);
                });
            } else if ((window as any).AndroidKiosk?.setOrientation) {
                (window as any).AndroidKiosk.setOrientation(degree);
            }

            if ((window as any).Capacitor?.Plugins?.ScreenOrientation) {
                const ScreenOrientation = (window as any).Capacitor.Plugins.ScreenOrientation;
                if (degree === 90) ScreenOrientation.lock({ orientation: 'portrait-primary' });
                else if (degree === 270) ScreenOrientation.lock({ orientation: 'portrait-secondary' });
                else if (degree === 180) ScreenOrientation.lock({ orientation: 'landscape-secondary' });
                else ScreenOrientation.lock({ orientation: 'landscape-primary' });
            }
        }
        return cancelBridge;
    }, [deviceSettings.orientation]);

    // 4. Media Rotation Logic (los videos nunca se cortan: ver usePlaylistRotation)
    const { currentIndex, prevIndex, nextIndex, onVideoEnded, onVideoError, onVideoDuration } = usePlaylistRotation(
        items,
        status === 'playing' || status === 'offline_playing',
        contentKey,
        shuffle
    );

    // --- UI Renders ---
    
    const getRotationStyle = (orientation: string | undefined): React.CSSProperties => {
        // Web Admin orientation takes priority
        let degreeStr = (orientation !== undefined && orientation !== null && orientation !== '') 
            ? String(orientation) 
            : (localRotation !== null ? String(localRotation) : '0');

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
            <div className="fixed inset-0 w-full h-full flex flex-col items-center justify-center font-sans" style={BRAND_BACKGROUND}>
                <img src={BRAND_LOGO} alt="Display Digital" className="w-[22vw] max-w-[420px] animate-pulse" style={BRAND_LOGO_STYLE} />
                <div className="absolute bottom-[8vh] w-[40vw] max-w-[640px]">
                    {preloadProgress ? (
                        <>
                            <div className="text-[1.1vw] text-slate-400 mb-3 font-light text-center">
                                Descargando contenido · {preloadProgress.current} de {preloadProgress.total}
                            </div>
                            <div className="h-[3px] w-full bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-300"
                                    style={{ width: `${(preloadProgress.current / preloadProgress.total) * 100}%` }}
                                ></div>
                            </div>
                        </>
                    ) : (
                        <div className="text-[1.1vw] text-slate-500 font-light text-center tracking-wide">Conectando…</div>
                    )}
                </div>
            </div>
        );
    }

    if (status === 'no_content') {
        return (
            <div className="fixed inset-0 w-full h-full flex flex-col items-center justify-center font-sans text-center" style={BRAND_BACKGROUND}>
                <img src={BRAND_LOGO} alt="Display Digital" className="w-[18vw] max-w-[360px] mb-[4vh]" style={BRAND_LOGO_STYLE} />
                <div className="flex items-center gap-[0.8vw] text-emerald-400 text-[1.6vw] font-medium mb-[1.5vh]">
                    <span className="inline-block w-[0.9vw] h-[0.9vw] rounded-full bg-emerald-400 animate-pulse" />
                    Pantalla vinculada
                </div>
                <p className="text-[3vw] text-white font-semibold tracking-tight">{deviceName || `Pantalla ${deviceCode}`}</p>
                <p className="text-[1.5vw] text-slate-400 font-light mt-[2vh] max-w-[60vw]">
                    Todavía no tiene contenido asignado. Elegí qué mostrar desde{' '}
                    <span className="text-orange-400 font-medium whitespace-nowrap">app.event-pix.com.ar</span>
                </p>
                <p className="absolute bottom-[5vh] text-[1vw] text-slate-600 font-mono tracking-widest">CÓDIGO {deviceCode}</p>
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

    if (nothingToday && (status === 'playing' || status === 'offline_playing')) {
        // Todo lo de la playlist está fuera de fecha: solo el logo.
        return (
            <div className="fixed inset-0 w-full h-full flex items-center justify-center" style={BRAND_BACKGROUND}>
                <img src={BRAND_LOGO} alt="Display Digital" className="w-[18vw] max-w-[360px] opacity-80" style={BRAND_LOGO_STYLE} />
                <TvSettingsMenu deviceCode={deviceCode!} onRefresh={() => fetchCampaign()} />
            </div>
        );
    }

    return (
        <div style={containerStyle}>
            <MediaRenderer 
                items={items} 
                currentIndex={currentIndex} 
                prevIndex={prevIndex}
                nextIndex={nextIndex}
                deviceCommerceId={deviceCommerceId} 
                onVideoEnded={onVideoEnded}
                onVideoError={onVideoError}
                onVideoDuration={onVideoDuration}
                lite={lite}
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
