import { Submission } from '@/types';
import type { EventSettings } from '@/hooks/use-event-settings';

// Demo personal de la landing ("Probalo gratis"): una pantalla que ya está
// llena de fotos de ejemplo y donde aparece la selfie de quien la prueba.
// La foto viaja directo del celular a esa pantalla por un canal de Supabase
// Realtime (broadcast): no se guarda en ningún lado y nadie más la ve.

/** WhatsApp de ventas (el mismo de la landing) */
export const SALES_WHATSAPP = '543624547382';

export const salesWhatsAppUrl = (text = '¡Hola! Probé la demo de EventPix y me encantó. ¿Tienen disponible mi fecha?') =>
    `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(text)}`;

/**
 * Fotos de ejemplo del muro. Para usar fotos reales de eventos, copiarlas a
 * public/demo/ y cambiar las rutas acá (vertical u horizontal, ~1200px).
 */
const DEMO_PHOTOS: { url: string; author?: string; caption?: string }[] = [
    { url: '/demo/novios-anillo.jpg', author: 'Sofi', caption: '¡Sí, quiero! 💍' },
    { url: '/demo/amigos.jpg', author: 'Los amigos', caption: '¡La mejor boda!' },
    { url: '/demo/selfie-novios.jpg', author: 'Laura y Raúl', caption: 'Felices 💛' },
    { url: '/demo/salon.jpg', author: 'Pao', caption: '¡Qué lindo salón!' },
    { url: '/demo/amigas.jpg', author: 'Vero', caption: '¡Qué noche!' },
    { url: '/demo/vaso-souvenir.jpg', author: 'Meli', caption: 'Los souvenirs 😍' },
    { url: '/demo/novios.jpg', author: 'Martín' },
    { url: '/demo/mesa.jpg', author: 'Mesa 4' },
    { url: '/demo/novios-noche.jpg', author: 'Juli', caption: 'Hermosos' },
    { url: '/demo/pista.jpg', author: 'Nico', caption: '¡A bailar!' },
];

const DEMO_MESSAGES: { text: string; author: string }[] = [
    { text: '¡Muchas felicidades! ¡Los queremos!', author: 'Tía Marta' },
    { text: 'La mejor boda 🎉', author: 'Los del trabajo' },
];

/** Contenido inicial de la pantalla de demo (de lo más nuevo a lo más viejo, como el muro real) */
export const demoInitialItems = (): Submission[] => {
    const now = Date.now();
    const photos = DEMO_PHOTOS.map((p, i) => ({
        id: `demo-p${i}`,
        type: 'photo' as const,
        content: p.url,
        author: p.author,
        caption: p.caption ?? null,
        status: 'approved' as const,
        created_at: new Date(now - (i + 1) * 4 * 60000).toISOString(),
    }));
    const messages = DEMO_MESSAGES.map((m, i) => ({
        id: `demo-m${i}`,
        type: 'message' as const,
        content: m.text,
        author: m.author,
        status: 'approved' as const,
        created_at: new Date(now - (i * 3 + 2) * 4 * 60000).toISOString(),
    }));
    return [...photos, ...messages].sort((a, b) => b.created_at.localeCompare(a.created_at));
};

/** Ajustes de la pantalla de demo (los mismos campos que un evento real) */
export const DEMO_SETTINGS = {
    id: 'demo',
    title: 'Boda de Laura & Raúl',
    description: '',
    background_image_url: '/event-hero.jpg',
    display_background_url: null,
    display_template: 'grid',
    text_messages_enabled: true,
    carousel_max_loops: 3,
    carousel_interval_ms: 8000,
    wall_show_controls: false,
    font_family: 'font-serif',
    accent_color: null,
    created_at: '',
    updated_at: '',
} satisfies EventSettings;

/** Lo que manda el celular a la pantalla */
export interface DemoPost {
    id: string;
    type: 'photo' | 'message';
    /** Foto como data URL (JPEG chico) o el texto del mensaje */
    content: string;
    author?: string;
    caption?: string;
}

export const DEMO_EVENT = 'demo-post';
export const demoChannelName = (session: string) => `demo-wall-${session}`;

/** Código corto para la sesión de demo (va en el QR) */
export const newDemoSession = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');

export const isValidDemoSession = (s?: string | null) => !!s && /^[a-z0-9]{4,12}$/.test(s);

export const postToSubmission = (post: DemoPost): Submission => ({
    id: post.id,
    type: post.type,
    content: post.content,
    author: post.author?.slice(0, 40),
    caption: post.caption?.slice(0, 120) || null,
    status: 'approved',
    created_at: new Date().toISOString(),
});
