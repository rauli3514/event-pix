// Prueba de 7 días (página /probar): datos del formulario, el cartel de ejemplo
// que se crea según el rubro y los mensajes de error. Ver docs/pruebas.md.

import { POSTER_APP_ID, POSTER_GROUPS, POSTER_TEMPLATES, configFromTemplate, type PosterGroup } from '@/lib/posters';

export const RUBROS: readonly PosterGroup[] = POSTER_GROUPS;

// WhatsApp de ventas (el mismo de la web).
export const SALES_WHATSAPP = '5493624547382';

export const TV_COUNT_OPTIONS = ['1', '2', '3 o más', 'Todavía no tengo'] as const;
export const FUDO_OPTIONS = ['Sí', 'No'] as const;
export const SOURCE_OPTIONS = ['Instagram', 'Facebook', 'Google', 'Recomendación', 'Ya nos conocía', 'Otro'] as const;

// Cartel de ejemplo para cada rubro: uno con lista de productos y precios, que
// es lo que más se usa. Lleva el nombre del negocio al lado del título.
const STARTER_BY_RUBRO: Record<PosterGroup, string> = {
    'Comidas y restaurantes': 'pizzas',
    'Bares y cervecerías': 'pintas',
    'Heladerías y cafeterías': 'helados-precios',
    'Moda y accesorios': 'jeans',
    'Almacén y minoristas': 'kiosco',
    'Videojuegos y electrónica': 'consolas',
    'Vinotecas': 'vinos',
    'Gimnasios': 'gym-planes',
    'Otros': 'ofertas-semana',
};

export function starterPoster(rubro: string, businessName: string): { name: string; metadata: { appId: string; config: unknown } } | null {
    const id = STARTER_BY_RUBRO[rubro as PosterGroup] || STARTER_BY_RUBRO['Otros'];
    const template = POSTER_TEMPLATES.find(t => t.id === id);
    if (!template) return null;
    const config = { ...configFromTemplate(template, '16:9'), subtitle: businessName.trim().slice(0, 40) };
    return { name: `${template.name} (ejemplo)`, metadata: { appId: POSTER_APP_ID, config } };
}

export function contractWhatsappUrl(businessName?: string | null): string {
    const text = businessName
        ? `¡Hola! Estoy probando Display Digital con ${businessName} y quiero contratarlo.`
        : '¡Hola! Quiero contratar Display Digital.';
    return `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

export const supportWhatsappUrl = (businessName?: string | null) =>
    `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(`¡Hola! Tengo una consulta sobre Display Digital${businessName ? ` (${businessName})` : ''}.`)}`;

// Pantalla de prueba: una pestaña del navegador que hace de TV. Muestra un
// código que se carga en Pantallas → Agregar pantalla, igual que con el equipo.
export const TEST_SCREEN_URL = '/tv-boot?prueba';

export function openTestScreen() {
    window.open(TEST_SCREEN_URL, '_blank', 'noopener');
}

// Mensaje para la persona según el error del registro.
export function trialErrorText(message?: string): string {
    const m = message || '';
    if (/already registered|already been registered|user_already_exists|email_exists/i.test(m)) {
        return 'Ese email ya tiene una cuenta. Entrá con tu clave desde "Ya tengo cuenta".';
    }
    if (/trial_used/.test(m)) return 'Ya hay una prueba con ese email o ese WhatsApp. Escribinos y te ayudamos.';
    if (/already_has_commerce/.test(m)) return 'Esta cuenta ya tiene un negocio. Entrá desde "Ya tengo cuenta".';
    if (/missing_fields/.test(m)) return 'Completá tu nombre, el del negocio y un WhatsApp válido.';
    if (/password/i.test(m)) return 'La contraseña tiene que tener al menos 6 caracteres.';
    if (/invalid.*email|email.*invalid/i.test(m)) return 'Revisá el email.';
    if (/rate limit|too many/i.test(m)) return 'Hubo muchos intentos seguidos. Probá de nuevo en unos minutos.';
    if (/display_start_trial|PGRST202|schema cache|does not exist/i.test(m)) return 'El registro todavía no está habilitado. Escribinos por WhatsApp.';
    return 'No se pudo crear la cuenta. Probá de nuevo o escribinos por WhatsApp.';
}
