import {
    Clock, CloudSun, DollarSign, LayoutGrid, LayoutTemplate, Play, QrCode, Star, Tag, Type,
    type LucideIcon,
} from 'lucide-react';

// Tipos de app y sus colores e íconos (para las portadas de components/display/AppCover).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyItem = any;

export const APP_ITEM_TYPES = ['app', 'widget', 'layout'];
export const isAppItem = (item: AnyItem) => APP_ITEM_TYPES.includes(item?.type);
export const isWebItem = (item: AnyItem) => ['web', 'url', 'external_url'].includes(item?.type);

export interface AppKind {
    label: string;
    icon: LucideIcon;
    // Fondo de la portada (oscuro, para texto blanco en tema claro y oscuro).
    bg: string;
}

const APP_KINDS: Record<string, AppKind> = {
    weather: { label: 'Clima', icon: CloudSun, bg: 'from-sky-500 to-blue-800' },
    clock: { label: 'Reloj', icon: Clock, bg: 'from-indigo-500 to-slate-900' },
    dolar: { label: 'Dólar', icon: DollarSign, bg: 'from-emerald-500 to-emerald-900' },
    ticker: { label: 'Texto deslizante', icon: Type, bg: 'from-teal-500 to-slate-900' },
    qr: { label: 'Código QR', icon: QrCode, bg: 'from-violet-500 to-purple-900' },
    reviews: { label: 'Reseñas', icon: Star, bg: 'from-amber-400 to-orange-700' },
    'dynamic-menu': { label: 'Etiquetas', icon: Tag, bg: 'from-rose-500 to-rose-900' },
    youtube: { label: 'YouTube', icon: Play, bg: 'from-red-500 to-red-900' },
    'split-screen': { label: 'Pantalla dividida', icon: LayoutTemplate, bg: 'from-blue-500 to-indigo-900' },
};
const GENERIC_APP: AppKind = { label: 'App', icon: LayoutGrid, bg: 'from-slate-500 to-slate-800' };

export const appIdOf = (item: AnyItem): string | undefined => item?.metadata?.appId;
export const appKindOf = (item: AnyItem): AppKind => APP_KINDS[appIdOf(item) || ''] || GENERIC_APP;

// Etiqueta corta para el cartelito de tipo ("Clima", "Página web"…).
export function contentKindLabel(item: AnyItem): string | null {
    if (isAppItem(item)) return appKindOf(item).label;
    if (isWebItem(item)) return 'Página web';
    return null;
}

