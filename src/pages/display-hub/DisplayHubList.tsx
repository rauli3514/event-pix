import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Monitor, Plus, Hash, Eye, ChevronDown, Play, Bluetooth, Search, Settings2, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { EditScreenModal } from "@/components/display/EditScreenModal";
import { ZoneManagerSidebar } from "@/components/display/ZoneManagerSidebar";
import { MoveDeviceModal } from "@/components/display/MoveDeviceModal";
import { BluetoothProvisioningModal } from "@/components/display/BluetoothProvisioningModal";
import { useEffect, useMemo } from 'react';
import { ScreenCard } from '@/components/display/ScreenCard';
import { ChangeScreenContentModal } from '@/components/display/ChangeScreenContentModal';
import { ScreenQrModal } from '@/components/display/ScreenQrModal';
import { useDeviceScreens } from '@/hooks/use-device-screens';
import { describeContent, screenName } from '@/lib/screenStatus';
import { formatDownFor } from '@/lib/screenAlerts';
import { useNowMinute } from '@/hooks/use-now-minute';

import { toast } from 'sonner';

import { useDisplayDevices, useLinkDevice, useDisplayGroups, useUpdateDisplayDevice, useAssignContentToDevice } from "@/hooks/use-display-hub";
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { DisplayDevice } from '@/types/display';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDevice = any;

// Pantallas: todas las TVs del comercio, por zona, con su foto real y qué pasan.
const DisplayHubList = () => {
    const { commerceId } = useParams<{ commerceId: string }>();
    const [searchParams] = useSearchParams();
    
    const urlCode = searchParams.get('code') || searchParams.get('bt')?.replace('EventPix-TV-', '');
    
    // States for linking
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [isBluetoothModalOpen, setIsBluetoothModalOpen] = useState(!!urlCode);
    const [initialDeviceCode, setInitialDeviceCode] = useState<string | undefined>(urlCode || undefined);
    
    useEffect(() => {
        if (urlCode) {
            setInitialDeviceCode(urlCode);
            setIsBluetoothModalOpen(true);
        }
    }, [urlCode]);
    const [linkData, setLinkData] = useState({ device_code: '', name: '', description: '', group_id: 'none', orientation: 'landscape' as 'landscape' | 'portrait' });
    
    // States for filtering & sidebar
    const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');
    const [zonesOpen, setZonesOpen] = useState(false);
    const [changing, setChanging] = useState<AnyDevice>(null);
    const [qrFor, setQrFor] = useState<AnyDevice>(null);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    // Arrastrar una pantalla a otra zona.
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dropKey, setDropKey] = useState<string | null>(null);
    const [dropCardId, setDropCardId] = useState<string | null>(null);
    // Orden propio de las tarjetas: el guardado en la base (sort_order) o, si
    // todavía no se corrió el SQL, el de este navegador. Mientras se guarda, el nuevo.
    const orderKey = `screens_order:${commerceId}`;
    const [localOrder, setLocalOrder] = useState<Record<string, number>>(() => {
        try { return JSON.parse(localStorage.getItem(`screens_order:${commerceId}`) || '{}'); } catch { return {}; }
    });
    const [pendingOrder, setPendingOrder] = useState<Record<string, number>>({});
    const [pendingZone, setPendingZone] = useState<Record<string, string>>({});
    const [search, setSearch] = useState('');
    const [selectedGroupId, setSelectedGroupId] = useState<string | 'all' | 'unassigned'>('all');
    
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState<any>(null);

    const effectiveCommerceId = commerceId || 'unknown';

    // Data Fetching
    const { data: devices, isLoading } = useDisplayDevices(effectiveCommerceId);
    const { data: linkGroups } = useDisplayGroups(effectiveCommerceId);
    const linkDevice = useLinkDevice();
    const updateDevice = useUpdateDisplayDevice();
    const assignContent = useAssignContentToDevice();
    const queryClient = useQueryClient();

    // Preview state
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [previewDevice, setPreviewDevice] = useState<any>(null);

    // Move Device state
    const [moveDeviceModalOpen, setMoveDeviceModalOpen] = useState(false);
    const [moveDeviceTarget, setMoveDeviceTarget] = useState<DisplayDevice | null>(null);

    const linkedDevices = devices?.filter(d => d.pairing_status === 'linked') || [];
    const pendingDevices = devices?.filter(d => d.pairing_status === 'pending') || [];
    
    const unassignedCount = linkedDevices.filter(d => !d.group_id).length;

    const handleLinkSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!linkData.device_code.trim()) {
            toast.error('Escribí el código que muestra la TV');
            return;
        }

        // Si estamos adentro de una zona, pre-asignarla
        const targetGroup = linkData.group_id !== 'none' 
            ? linkData.group_id 
            : (selectedGroupId !== 'all' && selectedGroupId !== 'unassigned' ? selectedGroupId : undefined);

        linkDevice.mutate({ 
            device_code: linkData.device_code.trim(), 
            name: linkData.name, 
            description: linkData.description,
            orientation: linkData.orientation,
            commerce_id: effectiveCommerceId,
            group_id: targetGroup || undefined
        }, {
            onSuccess: () => {
                setIsLinkModalOpen(false);
                setLinkData({ device_code: '', name: '', description: '', group_id: 'none', orientation: 'landscape' });
                toast.success('Pantalla vinculada');
            },
            onError: (error: any) => {
                toast.error(error.message || 'Error al vincular pantalla');
            }
        });
    };

    const handleDeleteDevice = async (deviceId: string) => {
        if (!confirm('¿Eliminar esta pantalla? Deja de mostrar contenido hasta que la vuelvas a vincular.')) return;
        const { error } = await supabase.from('display_devices').delete().eq('id', deviceId);
        if (error) {
            toast.error('No se pudo eliminar. Probá de nuevo.');
        } else {
            toast.success('Pantalla eliminada');
            queryClient.invalidateQueries({ queryKey: ["display_devices"] });
        }
    };

    // Zonas: nombre completo ("Local centro / Barra") y sus subzonas.
    const groupsList = linkGroups || [];
    const zonePath = (id: string | null | undefined): string => {
        const parts: string[] = [];
        let g = groupsList.find(x => x.id === id);
        let guard = 0;
        while (g && guard++ < 10) {
            parts.unshift(g.name);
            g = groupsList.find(x => x.id === g!.parent_id);
        }
        return parts.join(' / ');
    };
    const zoneAndChildren = (id: string): Set<string> => {
        const out = new Set([id]);
        let added = true;
        while (added) {
            added = false;
            for (const g of groupsList) {
                if (g.parent_id && out.has(g.parent_id) && !out.has(g.id)) { out.add(g.id); added = true; }
            }
        }
        return out;
    };

    const zoneOf = (d: AnyDevice): string => pendingZone[d.id] ?? (d.group_id || '');
    const orderOf = (d: AnyDevice): number | null => pendingOrder[d.id] ?? d.sort_order ?? localOrder[d.id] ?? null;

    const filteredLinkedDevices = linkedDevices.filter(device => {
        // Status filter
        const matchesStatus = filter === 'all' 
            ? true 
            : filter === 'online' ? device.derived_status === 'online' : device.derived_status === 'offline';
        
        // Group filter
        let matchesGroup = true;
        if (selectedGroupId === 'unassigned') matchesGroup = !device.group_id;
        else if (selectedGroupId !== 'all') {
            // Include devices in this group OR sub-groups. For simplicity, just exact match or build tree logic.
            // A more advanced version would check if device.group_id is a descendant.
            matchesGroup = !!device.group_id && zoneAndChildren(selectedGroupId).has(device.group_id);
        }
        
        // Search filter
        const searchLower = search.toLowerCase();
        const matchesSearch = (device.name?.toLowerCase().includes(searchLower)) || 
                              (device.device_id.toLowerCase().includes(searchLower));
                              
        return matchesStatus && matchesGroup && matchesSearch;
    });


    const now = useNowMinute();
    const nowMs = now.getTime();
    const { data: screenShots = {} } = useDeviceScreens(linkedDevices.map(d => d.id));
    const nowPlaying = (d: AnyDevice): string | null => {
        const shot = screenShots[d.id];
        if (!shot?.now_playing?.name) return null;
        return nowMs - new Date(shot.captured_at).getTime() < 15 * 60 * 1000 ? shot.now_playing.name : null;
    };
    const onlineCount = linkedDevices.filter(d => d.derived_status === 'online').length;
    const offlineCount = linkedDevices.length - onlineCount;

    // Agrupadas por zona (las sin zona al final), en línea primero.
    const sections = useMemo(() => {
        const map = new Map<string, AnyDevice[]>();
        for (const d of filteredLinkedDevices) {
            const key = zoneOf(d);
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(d);
        }
        // El orden propio primero; las que no tienen, después (en línea primero).
        const sortDevices = (list: AnyDevice[]) => list.sort((a, b) =>
            (orderOf(a) ?? 1e9) - (orderOf(b) ?? 1e9)
            || (a.derived_status === 'online' ? 0 : 1) - (b.derived_status === 'online' ? 0 : 1)
            || screenName(a).localeCompare(screenName(b)));
        return [...map.entries()]
            .map(([key, list]) => ({ key, name: key ? zonePath(key) || 'Zona' : 'Sin zona', devices: sortDevices(list) }))
            .sort((a, b) => (a.key ? 0 : 1) - (b.key ? 0 : 1) || a.name.localeCompare(b.name));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredLinkedDevices.map(d => d.id + d.derived_status + d.group_id + d.sort_order).join(), linkGroups, pendingOrder, pendingZone, localOrder]);

    // Zona destino: id de la zona, o '' para "sin zona".
    const moveToZone = (deviceId: string, zoneId: string) => {
        const device = linkedDevices.find(d => d.id === deviceId);
        setDraggingId(null);
        setDropKey(null);
        if (!device || (device.group_id || '') === zoneId) return;
        updateDevice.mutate({ id: deviceId, updates: { group_id: zoneId || null } }, {
            onSuccess: () => toast.success(`${screenName(device)} → ${zoneId ? zonePath(zoneId) : 'sin zona'}`),
            onError: () => toast.error('No se pudo cambiar de zona. Probá de nuevo.'),
        });
    };
    // Soltar una tarjeta sobre otra: queda justo antes, en la zona de esa tarjeta.
    const reorder = async (dragId: string, targetId: string) => {
        setDraggingId(null);
        setDropKey(null);
        setDropCardId(null);
        if (dragId === targetId) return;
        const dragged = linkedDevices.find(d => d.id === dragId);
        const target = linkedDevices.find(d => d.id === targetId);
        if (!dragged || !target) return;
        const zone = zoneOf(target);
        const section = sections.find(sec => sec.key === zone);
        if (!section) return;
        const list = section.devices.filter(d => d.id !== dragId);
        list.splice(list.findIndex(d => d.id === targetId), 0, dragged);
        const order: Record<string, number> = {};
        list.forEach((d, i) => { order[d.id] = (i + 1) * 10; });
        const zoneChanged = zoneOf(dragged) !== zone;
        setPendingOrder(prev => ({ ...prev, ...order }));
        if (zoneChanged) setPendingZone(prev => ({ ...prev, [dragId]: zone }));

        const results = await Promise.all(list.map(d => supabase
            .from('display_devices')
            .update({ sort_order: order[d.id], ...(d.id === dragId && zoneChanged ? { group_id: zone || null } : {}) })
            .eq('id', d.id)));
        const failed = results.find(r => r.error);
        if (failed?.error && /sort_order/.test(failed.error.message || '')) {
            // Falta el SQL: el orden queda en este navegador (y la zona, en la base).
            if (zoneChanged) await supabase.from('display_devices').update({ group_id: zone || null }).eq('id', dragId);
            const next = { ...localOrder, ...order };
            setLocalOrder(next);
            try { localStorage.setItem(orderKey, JSON.stringify(next)); } catch { /* sin espacio */ }
            toast.info('Orden guardado en esta computadora. Para verlo igual en todos lados, corré el SQL del orden (docs/pantallas.md).');
        } else if (failed?.error) {
            toast.error('No se pudo guardar el orden. Probá de nuevo.');
            setPendingOrder(prev => { const n = { ...prev }; list.forEach(d => delete n[d.id]); return n; });
            setPendingZone(prev => { const n = { ...prev }; delete n[dragId]; return n; });
            return;
        } else if (zoneChanged) {
            toast.success(`${screenName(dragged)} → ${zone ? zonePath(zone) : 'sin zona'}`);
        }
        await queryClient.invalidateQueries({ queryKey: ['display_devices'] });
        setPendingOrder(prev => { const n = { ...prev }; list.forEach(d => delete n[d.id]); return n; });
        setPendingZone(prev => { const n = { ...prev }; delete n[dragId]; return n; });
    };

    const cardDropProps = (targetId: string) => ({
        onDragOver: (e: React.DragEvent) => {
            if (!draggingId || draggingId === targetId) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (dropCardId !== targetId) setDropCardId(targetId);
        },
        onDragLeave: () => setDropCardId(prev => (prev === targetId ? null : prev)),
        onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            const id = e.dataTransfer.getData('text/plain') || draggingId;
            if (id) reorder(id, targetId);
        },
    });

    // Props para que algo reciba una pantalla arrastrada.
    const dropProps = (zoneId: string) => ({
        onDragOver: (e: React.DragEvent) => {
            if (!draggingId) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (dropKey !== zoneId) setDropKey(zoneId);
        },
        onDragLeave: () => setDropKey(prev => (prev === zoneId ? null : prev)),
        onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            const id = e.dataTransfer.getData('text/plain') || draggingId;
            if (id) moveToZone(id, zoneId);
        },
    });
    const dropRing = (zoneId: string) => (draggingId && dropKey === zoneId ? ' ring-2 ring-indigo-500 ring-offset-2 ring-offset-background' : '');

    const openLinkWithCode = (code: string) => {
        setLinkData(prev => ({ ...prev, device_code: code }));
        setIsLinkModalOpen(true);
    };

    if (isLoading) return (
        <div className="h-full flex items-center justify-center bg-background text-foreground">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground">Cargando pantallas…</p>
            </div>
        </div>
    );

    const zoneChip = (active: boolean) =>
        `shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${active
            ? 'border-indigo-600 bg-indigo-600 text-white'
            : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-indigo-500/50'}`;
    const statusChip = (active: boolean, tone: 'emerald' | 'amber' | 'slate') => {
        const on = tone === 'emerald' ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : tone === 'amber' ? 'border-amber-500/60 bg-amber-500/10 text-amber-800 dark:text-amber-300'
            : 'border-indigo-600 bg-indigo-600/10 text-indigo-700 dark:text-indigo-300';
        return `inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${active ? on : 'border-border bg-card text-muted-foreground hover:text-foreground'}`;
    };

    return (
        <div className="h-full w-full overflow-y-auto bg-background text-foreground">
            <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
                {/* Encabezado */}
                <header className="flex flex-wrap items-end justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Pantallas</h1>
                        <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
                            Tus TVs, con lo que están pasando ahora. Ordenalas por zona (salón, vidriera, barra) para encontrarlas rápido.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" className="h-11 px-4" onClick={() => setIsBluetoothModalOpen(true)}>
                            <Bluetooth className="w-4 h-4 mr-2 text-blue-500" /> Configurar por Bluetooth
                        </Button>
                        <Button className="h-11 px-5 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setIsLinkModalOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" /> Agregar pantalla
                        </Button>
                    </div>
                </header>

                {/* Estado + búsqueda */}
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setFilter('all')} className={statusChip(filter === 'all', 'slate')}>
                        <Monitor className="w-4 h-4" /> Todas <span className="tabular-nums opacity-80">{linkedDevices.length}</span>
                    </button>
                    <button type="button" onClick={() => setFilter(filter === 'online' ? 'all' : 'online')} className={statusChip(filter === 'online', 'emerald')}>
                        <span className="w-2 h-2 rounded-full bg-emerald-500" /> En línea <span className="tabular-nums opacity-80">{onlineCount}</span>
                    </button>
                    <button type="button" onClick={() => setFilter(filter === 'offline' ? 'all' : 'offline')} className={statusChip(filter === 'offline', 'amber')}>
                        <span className="w-2 h-2 rounded-full bg-amber-500" /> Sin señal <span className="tabular-nums opacity-80">{offlineCount}</span>
                    </button>
                    <div className="relative ml-auto w-full sm:w-64">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input placeholder="Buscar por nombre o código" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 bg-card border-border" />
                    </div>
                </div>

                {/* Zonas */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    <button type="button" onClick={() => setSelectedGroupId('all')} className={zoneChip(selectedGroupId === 'all')}>Todas las zonas</button>
                    {groupsList.map(g => {
                        const count = linkedDevices.filter(d => d.group_id && zoneAndChildren(g.id).has(d.group_id)).length;
                        return (
                            <button key={g.id} type="button" onClick={() => setSelectedGroupId(g.id)} className={zoneChip(selectedGroupId === g.id) + dropRing(g.id)} {...dropProps(g.id)}>
                                {zonePath(g.id)} <span className="tabular-nums opacity-70">{count}</span>
                            </button>
                        );
                    })}
                    {groupsList.length > 0 && (unassignedCount > 0 || !!draggingId) && (
                        <button type="button" onClick={() => setSelectedGroupId('unassigned')} className={zoneChip(selectedGroupId === 'unassigned') + dropRing('')} {...dropProps('')}>
                            Sin zona <span className="tabular-nums opacity-70">{unassignedCount}</span>
                        </button>
                    )}
                    <button type="button" onClick={() => setZonesOpen(true)} className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-indigo-500/50">
                        <Settings2 className="w-4 h-4" /> {groupsList.length ? 'Organizar zonas' : 'Crear zonas'}
                    </button>
                </div>

                {draggingId && (
                    <p className="-mt-3 text-sm text-indigo-600 dark:text-indigo-400">
                        Soltala sobre otra pantalla para ponerla en ese lugar{groupsList.length > 0 ? ', o sobre una zona para moverla' : ''}.
                    </p>
                )}

                {/* TVs prendidas esperando que las vinculen */}
                {pendingDevices.length > 0 && (
                    <section className="rounded-2xl border border-dashed border-indigo-500/50 bg-indigo-500/5 p-4">
                        <p className="text-sm font-semibold flex items-center gap-2">
                            <span className="relative flex w-2.5 h-2.5"><span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60 animate-ping" /><span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-indigo-500" /></span>
                            {pendingDevices.length === 1 ? '1 TV espera que la vincules' : `${pendingDevices.length} TVs esperan que las vincules`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">Están prendidas con la app abierta. Fijate que el código coincida con el que muestra la pantalla.</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {pendingDevices.map(d => (
                                <div key={d.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
                                    <span className="font-mono text-lg font-bold tracking-widest">{d.device_id}</span>
                                    <span className="text-xs text-muted-foreground flex-1 min-w-0 truncate">
                                        {d.last_seen ? `vista ${formatDownFor(Math.max(0, nowMs - new Date(d.last_seen).getTime()))}` : 'recién prendida'}
                                    </span>
                                    <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => openLinkWithCode(d.device_id)}>
                                        <Link2 className="w-4 h-4 mr-1.5" /> Vincular
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Pantallas por zona */}
                {sections.map(section => {
                    const isCollapsed = !!collapsed[section.key];
                    const showHeader = sections.length > 1 || !!section.key;
                    return (
                        <section key={section.key || 'none'} className="space-y-3">
                            {showHeader && (
                                <button
                                    type="button"
                                    onClick={() => setCollapsed(prev => ({ ...prev, [section.key]: !isCollapsed }))}
                                    className={`flex items-center gap-2 text-left rounded-lg pr-2${dropRing(section.key)}`}
                                    aria-expanded={!isCollapsed}
                                    {...dropProps(section.key)}
                                >
                                    <span className={`w-1 h-5 rounded-full ${section.key ? 'bg-indigo-500' : 'bg-muted-foreground/40'}`} aria-hidden />
                                    <span className="text-lg font-bold">{section.name}</span>
                                    <span className="text-sm text-muted-foreground">
                                        {section.devices.length} {section.devices.length === 1 ? 'pantalla' : 'pantallas'}
                                        {section.devices.some(d => d.derived_status !== 'online') && ` · ${section.devices.filter(d => d.derived_status !== 'online').length} sin señal`}
                                    </span>
                                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                </button>
                            )}
                            {!isCollapsed && (
                                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                    {section.devices.map(d => (
                                        <ScreenCard
                                            key={d.id}
                                            device={d}
                                            content={describeContent(d, now)}
                                            shot={screenShots[d.id]}
                                            nowPlaying={nowPlaying(d)}
                                            zoneName={selectedGroupId === 'all' && sections.length > 1 ? null : (d.group_id ? zonePath(d.group_id) : null)}
                                            now={nowMs}
                                            onChangeContent={() => setChanging(d)}
                                            onQr={() => setQrFor(d)}
                                            onPreview={() => { setPreviewDevice(d); setPreviewModalOpen(true); }}
                                            onEdit={() => { setSelectedDevice(d); setEditModalOpen(true); }}
                                            onMove={() => { setMoveDeviceTarget(d); setMoveDeviceModalOpen(true); }}
                                            onDelete={() => handleDeleteDevice(d.id)}
                                            draggable
                                            dragging={draggingId === d.id}
                                            onDragStart={() => setDraggingId(d.id)}
                                            onDragEnd={() => { setDraggingId(null); setDropKey(null); setDropCardId(null); }}
                                            dropProps={cardDropProps(d.id)}
                                            dropHighlight={dropCardId === d.id && draggingId !== d.id}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    );
                })}

                {filteredLinkedDevices.length === 0 && (
                    <div className="rounded-2xl border-2 border-dashed border-border bg-card/40 p-10 md:p-14 flex flex-col items-center text-center gap-2">
                        <Monitor className="w-12 h-12 text-muted-foreground/60" />
                        {linkedDevices.length === 0 ? (
                            <>
                                <p className="text-lg font-semibold">Todavía no hay pantallas</p>
                                <p className="text-sm text-muted-foreground max-w-md">Abrí la app de EventPix en la TV: te va a mostrar un código. Tocá "Agregar pantalla" y escribilo.</p>
                                <Button className="mt-4 h-11 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setIsLinkModalOpen(true)}><Plus className="w-4 h-4 mr-2" /> Agregar pantalla</Button>
                            </>
                        ) : (
                            <>
                                <p className="text-lg font-semibold">No hay pantallas con ese filtro</p>
                                <button type="button" onClick={() => { setFilter('all'); setSearch(''); setSelectedGroupId('all'); }} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Ver todas</button>
                            </>
                        )}
                    </div>
                )}

                <Sheet open={zonesOpen} onOpenChange={setZonesOpen}>
                    <SheetContent side="left" className="p-0 bg-card border-r-border w-72 flex flex-col">
                        <SheetTitle className="sr-only">Zonas</SheetTitle>
                        <ZoneManagerSidebar
                            commerceId={effectiveCommerceId}
                            groups={groupsList}
                            selectedGroupId={selectedGroupId}
                            onSelectGroup={id => { setSelectedGroupId(id); setZonesOpen(false); }}
                            unassignedCount={unassignedCount}
                            totalCount={linkedDevices.length}
                        />
                    </SheetContent>
                </Sheet>

                <ChangeScreenContentModal
                    isOpen={!!changing}
                    onClose={() => setChanging(null)}
                    commerceId={effectiveCommerceId}
                    device={changing ? { id: changing.id, name: screenName(changing) } : null}
                    currentCampaignId={changing?.assignment?.campaign_id || null}
                    currentScheduleId={changing?.assignment?.schedule_id || null}
                />
                <ScreenQrModal
                    isOpen={!!qrFor}
                    onClose={() => setQrFor(null)}
                    commerceId={effectiveCommerceId}
                    screen={qrFor ? { ...qrFor, name: screenName(qrFor) } : null}
                    others={linkedDevices.filter(s => s.id !== qrFor?.id).map(s => ({ ...s, name: screenName(s) }))}
                />

                {/* Modal de Vinculación */}
                <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
                    <DialogContent className="sm:max-w-[700px] bg-card border-border text-foreground p-0 overflow-hidden flex flex-col max-h-[100dvh] sm:max-h-[90vh]">
                        <div className="p-4 sm:p-6 border-b border-border bg-muted/30 shrink-0">
                            <DialogTitle className="text-xl">Vincular una pantalla</DialogTitle>
                            <DialogDescription className="text-muted-foreground mt-1">
                                Abrí la app de EventPix en la TV: el código aparece en la pantalla.
                            </DialogDescription>
                        </div>
                        <div className="overflow-y-auto flex-1">
                            <form id="link-device-form" onSubmit={handleLinkSubmit} className="flex flex-col md:flex-row h-full">
                                {/* Left Side: Basic Info */}
                                <div className="flex-1 p-4 sm:p-6 space-y-5 border-b md:border-b-0 md:border-r border-border">
                                    <div className="space-y-2">
                                        <Label htmlFor="code" className="text-foreground font-bold">1. Código que muestra la TV</Label>
                                        <div className="relative">
                                            <Hash className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="code"
                                                value={linkData.device_code}
                                                onChange={(e) => setLinkData({ ...linkData, device_code: e.target.value.toUpperCase() })}
                                                placeholder="Ej: MX9-K7P2A"
                                                className="pl-9 bg-background border-indigo-500/50 text-foreground font-mono uppercase tracking-widest text-lg h-11 focus-visible:ring-indigo-500"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="name" className="text-foreground font-bold">2. Nombre</Label>
                                        <Input
                                            id="name"
                                            value={linkData.name}
                                            onChange={(e) => setLinkData({ ...linkData, name: e.target.value })}
                                            placeholder="Ej: TV Salón Principal"
                                            className="bg-background border-border text-foreground h-11 focus-visible:ring-primary"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="group" className="text-foreground font-bold">3. Zona</Label>
                                        <Select value={linkData.group_id} onValueChange={(val) => setLinkData({ ...linkData, group_id: val })}>
                                            <SelectTrigger className="w-full bg-background border-border text-foreground h-11 focus:ring-primary">
                                                <SelectValue placeholder="Sin zona" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-card border-border text-foreground">
                                                <SelectItem value="none">Sin zona</SelectItem>
                                                {linkGroups?.map(g => (
                                                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Right Side: Orientation */}
                                <div className="flex-1 p-4 sm:p-6 bg-background">
                                    <Label className="text-foreground font-bold mb-4 block">4. Cómo está la TV</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Horizontal */}
                                        <button 
                                            type="button"
                                            onClick={() => setLinkData({ ...linkData, orientation: 'landscape' })}
                                            className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all ${
                                                linkData.orientation === 'landscape' ? 'border-indigo-600 bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'border-border bg-card text-muted-foreground hover:border-indigo-500/50 hover:bg-muted'
                                            }`}
                                        >
                                            <div className="w-16 h-10 border-2 border-current rounded flex items-center justify-center mb-3">
                                                <Play className="w-4 h-4 ml-1" />
                                            </div>
                                            <span className="font-semibold text-sm">Horizontal</span>
                                            <span className="text-xs opacity-70 mt-1 hidden sm:block">FHD 1080p</span>
                                        </button>

                                        {/* Vertical */}
                                        <button 
                                            type="button"
                                            onClick={() => setLinkData({ ...linkData, orientation: 'portrait' })}
                                            className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all ${
                                                linkData.orientation === 'portrait' ? 'border-indigo-600 bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'border-border bg-card text-muted-foreground hover:border-indigo-500/50 hover:bg-muted'
                                            }`}
                                        >
                                            <div className="w-10 h-16 border-2 border-current rounded flex items-center justify-center mb-3">
                                                <Play className="w-4 h-4 ml-1" />
                                            </div>
                                            <span className="font-semibold text-sm">Vertical</span>
                                            <span className="text-xs opacity-70 mt-1 hidden sm:block">FHD 1080p</span>
                                        </button>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-4 text-center">
                                        Se puede cambiar después desde los ajustes de la pantalla.
                                    </p>
                                </div>
                            </form>
                        </div>
                        <div className="p-4 border-t border-border flex justify-end gap-3 bg-muted/20 shrink-0">
                            <Button type="button" variant="ghost" onClick={() => setIsLinkModalOpen(false)}>Cancelar</Button>
                            <Button type="submit" form="link-device-form" className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[140px] h-10" disabled={linkDevice.isPending}>
                                {linkDevice.isPending ? 'Vinculando…' : 'Vincular pantalla'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                <EditScreenModal 
                    isOpen={editModalOpen} 
                    onClose={() => setEditModalOpen(false)} 
                    device={selectedDevice}
                    linkGroups={linkGroups || []}
                    commerceId={commerceId}
                    onSave={(id, updates, asset) => {
                        updateDevice.mutate({ id, updates }, {
                            onSuccess: () => {
                                if (asset) {
                                    let payload: any = { deviceId: id, mediaId: null, campaignId: null, scheduleId: null };
                                    if (asset.type === 'campaign') {
                                        payload.campaignId = asset.id;
                                    } else if (asset.type === 'schedule') {
                                        payload.scheduleId = asset.id;
                                    } else {
                                        payload.mediaId = asset.id;
                                    }

                                    assignContent.mutate(payload, {
                                        onSuccess: () => {
                                            toast.success('Pantalla y contenido actualizados');
                                            setEditModalOpen(false);
                                        },
                                        onError: (err: any) => {
                                            console.error("Assign content failed:", err);
                                            toast.error(`Error al asignar: ${err.message || "Error desconocido"}`);
                                        }
                                    });
                                } else {
                                    toast.success('Pantalla actualizada');
                                    setEditModalOpen(false);
                                }
                            },
                            onError: (err: any) => {
                                console.error("Update device failed:", err);
                                toast.error(`Error al actualizar pantalla: ${err.message || "Error desconocido"}`);
                            }
                        });
                    }}
                />

                <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
                    <DialogContent className="bg-card border-border text-foreground shadow-2xl max-w-4xl p-0 overflow-hidden sm:rounded-2xl h-[80vh] flex flex-col">
                        <DialogHeader className="px-6 py-4 border-b border-border bg-muted flex flex-row items-center justify-between shrink-0">
                            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                                <Eye className="w-5 h-5 text-primary" />
                                Cómo se ve: {previewDevice?.name}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden">
                            {previewDevice ? (
                                <iframe 
                                    src={`/tv/${previewDevice.device_id}`}
                                    className="w-full h-full border-0"
                                    title="Vista Previa TV"
                                    allow="autoplay; fullscreen"
                                />
                            ) : (
                                <div className="text-muted-foreground text-center">
                                    <Monitor className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                    <p>Cargando vista previa...</p>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Modal de Mover */}
                <MoveDeviceModal 
                    isOpen={moveDeviceModalOpen}
                    onClose={() => setMoveDeviceModalOpen(false)}
                    device={moveDeviceTarget}
                    groups={linkGroups || []}
                    commerceId={effectiveCommerceId}
                />

                {/* Modal de Aprovisionamiento Bluetooth */}
                <BluetoothProvisioningModal 
                    isOpen={isBluetoothModalOpen}
                    onClose={() => {
                        setIsBluetoothModalOpen(false);
                        setInitialDeviceCode(undefined);
                    }}
                    commerceId={effectiveCommerceId}
                    initialDeviceCode={initialDeviceCode}
                />
            </div>
        </div>
    );
};

export default DisplayHubList;
