
export interface ThemeVariant {
    id: string;
    imageUrl: string;
}

export interface Theme {
    id: string;
    name: string;
    description: string;
    font: string;
    fontName: string;
    frameUrl?: string; // Marco Decorativo Opcional
    variants: ThemeVariant[];
}

export interface ThemeCategory {
    id: string;
    name: string;
    themes: Theme[];
}

export const THEME_CATEGORIES: ThemeCategory[] = [
    {
        id: 'weddings',
        name: 'Bodas & Elegancia',
        themes: [
            {
                id: 'gold_luxury',
                name: 'Golden Luxury',
                description: 'Lujo clásico con detalles dorados.',
                font: 'font-serif', // Playfair Display
                fontName: 'Playfair Display',
                frameUrl: 'https://png.pngtree.com/png-clipart/20220131/original/pngtree-golden-particles-abstract-light-effect-png-image_7259468.png',
                variants: [
                    { id: 'boda_1', imageUrl: '/themes/boda/aaron-burden-FHWgqOniOSY-unsplash.jpg' },
                    { id: 'boda_2', imageUrl: '/themes/boda/al-elmes-ULHxWq8reao-unsplash.jpg' },
                    { id: 'boda_3', imageUrl: '/themes/boda/alvin-mahmudov-9_XfcBxf_uo-unsplash.jpg' },
                    { id: 'boda_4', imageUrl: '/themes/boda/andy-holmes-cbe2y8SK2Xc-unsplash.jpg' },
                ]
            },
            {
                id: 'romantic_white',
                name: 'Romantic White',
                description: 'La pureza del blanco en tu boda.',
                font: 'font-wedding', // Great Vibes
                fontName: 'Great Vibes',
                frameUrl: 'https://png.pngtree.com/png-clipart/20220604/original/pngtree-rose-petals-falling-png-image_7904033.png',
                variants: [
                    { id: 'boda_5', imageUrl: '/themes/boda/ben-rosett-nYugmV-SY6s-unsplash.jpg' },
                    { id: 'boda_6', imageUrl: '/themes/boda/darren-nunis-cxE7SXKnzv0-unsplash.jpg' },
                    { id: 'boda_7', imageUrl: '/themes/boda/kerri-shaver-xepikEyPgmI-unsplash.jpg' },
                    { id: 'boda_8', imageUrl: '/themes/boda/mariia-pravedna-Kh0-BXVW8Xs-unsplash.jpg' },
                ]
            }
        ]
    },
    {
        id: 'quince',
        name: '15 Años & Teens',
        themes: [
            {
                id: 'sweet_fifteen',
                name: 'Sweet 15',
                description: 'Momentos mágicos e inolvidables.',
                font: 'font-serif', // Playfair
                fontName: 'Playfair Display',
                frameUrl: 'https://png.pngtree.com/png-clipart/20221223/original/pngtree-rose-gold-stardust-light-effect-transparent-background-png-image_8797931.png',
                variants: [
                    { id: '15_1', imageUrl: '/themes/quince/a-l-ya631mqQ7Ng-unsplash.jpg' },
                    { id: '15_2', imageUrl: '/themes/quince/adam-kring-1pMRoKhF84k-unsplash.jpg' },
                    { id: '15_3', imageUrl: '/themes/quince/aditya-chinchure-ZhQCZjr9fHo-unsplash.jpg' },
                    { id: '15_4', imageUrl: '/themes/quince/alexander-grey-W7cPLHOa0eQ-unsplash.jpg' },
                ]
            },
            {
                id: 'teen_party',
                name: 'Teen Party',
                description: 'Diversión y estilo moderno.',
                font: 'font-modern', // Montserrat
                fontName: 'Montserrat',
                frameUrl: 'https://png.pngtree.com/png-clipart/20230131/original/pngtree-geometric-frame-design-png-image_8941088.png',
                variants: [
                    { id: '15_5', imageUrl: '/themes/quince/benjamin-wong-WoViiJWKLik-unsplash.jpg' },
                    { id: '15_6', imageUrl: '/themes/quince/danny-howe-bn-D2bCvpik-unsplash.jpg' },
                    { id: '15_7', imageUrl: '/themes/quince/ddp-uwH8zpibUVc-unsplash.jpg' },
                    { id: '15_8', imageUrl: '/themes/quince/deep-boda-tqe1jIgyhhs-unsplash.jpg' },
                    { id: '15_9', imageUrl: '/themes/quince/designecologist-W2REjHflRU4-unsplash.jpg' },
                ]
            }
        ]
    },
    {
        id: 'rustic',
        name: 'Rústico & Día',
        themes: [
            {
                id: 'rustic_wood',
                name: 'Rustic Wood',
                description: 'Madera, luces cálidas y naturaleza.',
                font: 'font-hand', // Fredoka
                fontName: 'Fredoka',
                frameUrl: 'https://png.pngtree.com/png-clipart/20221227/original/pngtree-hanging-polaroid-photo-frame-with-tape-png-image_8813233.png',
                variants: [
                    { id: 'rustic_custom_1', imageUrl: '/themes/rustic/rustic-wood.jpg' },
                    { id: 'rustic_custom_2', imageUrl: '/themes/rustic/rustic-lights.jpg' },
                    { id: 'rustic_custom_3', imageUrl: '/themes/rustic/rustic-white.jpg' },
                    { id: 'rustic_1', imageUrl: '/themes/boda/darren-nunis-cxE7SXKnzv0-unsplash.jpg' },
                    { id: 'rustic_2', imageUrl: '/themes/boda/kent-pilcher-87MIF4vqHWg-unsplash.jpg' },
                    { id: 'rustic_3', imageUrl: '/themes/boda/sj-38adackPTsI-unsplash.jpg' },
                    { id: 'rustic_4', imageUrl: '/themes/boda/al-elmes-ULHxWq8reao-unsplash.jpg' },
                ]
            }
        ]
    },
    {
        id: 'party',
        name: 'Fiesta & Neon',
        themes: [
            {
                id: 'neon_night',
                name: 'Neon Night',
                description: 'Luces, láser y mucha energía.',
                font: 'font-neon', // Orbitron
                fontName: 'Orbitron',
                frameUrl: 'https://png.pngtree.com/png-clipart/20230401/original/pngtree-neon-light-effect-particles-border-png-image_9013892.png',
                variants: [
                    { id: 'neon_1', imageUrl: '/themes/neon/abdul-salam-afsal-m-a-xtMxlUIj-AY-unsplash.jpg' },
                    { id: 'neon_2', imageUrl: '/themes/neon/boitumelo-jv5jNADcg-k-unsplash.jpg' },
                    { id: 'neon_3', imageUrl: '/themes/neon/drew-beamer-3SIXZisims4-unsplash.jpg' },
                    { id: 'neon_4', imageUrl: '/themes/neon/drew-beamer-vAij-E26haI-unsplash.jpg' },
                    { id: 'neon_5', imageUrl: '/themes/neon/fabian-moller-gI7zgb80QWY-unsplash.jpg' },
                    { id: 'neon_6', imageUrl: '/themes/neon/gary-butterfield-HJ6g9w4ajDw-unsplash.jpg' },
                ]
            }
        ]
    },
    {
        id: 'kids',
        name: 'Infantil & Diversión',
        themes: [
            {
                id: 'kids_world',
                name: 'Mundo Mágico',
                description: 'Colores y alegría para los peques.',
                font: 'font-modern', // Montserrat
                fontName: 'Montserrat',
                frameUrl: 'https://png.pngtree.com/png-clipart/20220926/original/pngtree-colorful-confetti-border-png-image_8631481.png',
                variants: [
                    { id: 'kids_1', imageUrl: '/themes/infantil/adi-goldstein-Hli3R6LKibo-unsplash.jpg' },
                    { id: 'kids_2', imageUrl: '/themes/infantil/alexander-grey-7EK5WABscqw-unsplash.jpg' },
                    { id: 'kids_3', imageUrl: '/themes/infantil/chris-lawton-vBA-JNHAraI-unsplash.jpg' },
                    { id: 'kids_4', imageUrl: '/themes/infantil/greyson-joralemon-9IBqihqhuHc-unsplash.jpg' },
                    { id: 'kids_5', imageUrl: '/themes/infantil/luca-upper-Z-4kOr93RCI-unsplash.jpg' },
                ]
            }
        ]
    },
    {
        id: 'tecno',
        name: 'Tecno & Abstract',
        themes: [
            {
                id: 'tech_vibes',
                name: 'Tech Vibes',
                description: 'Diseños abstractos y futuristas.',
                font: 'font-neon', // Orbitron
                fontName: 'Orbitron',
                frameUrl: 'https://png.pngtree.com/png-clipart/20220615/original/pngtree-blue-technology-glowing-border-png-image_8033789.png',
                variants: [
                    { id: 'tecno_1', imageUrl: '/themes/tecno /aleksandr-popov-2XKAUkbq218-unsplash.jpg' },
                    { id: 'tecno_2', imageUrl: '/themes/tecno /aleksandr-popov-3InMDrsuYrk-unsplash.jpg' },
                    { id: 'tecno_3', imageUrl: '/themes/tecno /aleksandr-popov-Eq5wbIf59vo-unsplash.jpg' },
                    { id: 'tecno_4', imageUrl: '/themes/tecno /andrew-knechel-gG6yehL64fo-unsplash.jpg' },
                    { id: 'tecno_5', imageUrl: '/themes/tecno /carl-raw-m3hn2Kn5Bns-unsplash.jpg' },
                ]
            }
        ]
    },
    {
        id: 'gradients',
        name: 'Abstracto & Minimalista',
        themes: [
            {
                id: 'soft_gradients',
                name: 'Soft Auras',
                description: 'Gradientes modernos y relajantes.',
                font: 'font-modern', // Montserrat
                fontName: 'Montserrat',
                frameUrl: '',
                variants: [
                    { id: 'gradient_1', imageUrl: 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2029&auto=format&fit=crop' }, // Blue/Purple
                    { id: 'gradient_2', imageUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=2070&auto=format&fit=crop' }, // Multi color
                    { id: 'gradient_3', imageUrl: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?q=80&w=2029&auto=format&fit=crop' }, // Violet
                    { id: 'gradient_4', imageUrl: 'https://images.unsplash.com/photo-1508615039623-a25605d2b022?q=80&w=2070&auto=format&fit=crop' }, // Teal
                    { id: 'gradient_5', imageUrl: 'https://images.unsplash.com/photo-1614850523060-8da1d56ae167?q=80&w=2070&auto=format&fit=crop' }  // Liquid
                ]
            },
            {
                id: 'dark_minimal',
                name: 'Dark Elegance',
                description: 'Fondos oscuros para resaltar las fotos.',
                font: 'font-sans',
                fontName: 'Inter',
                frameUrl: '',
                variants: [
                    { id: 'dark_1', imageUrl: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=2074&auto=format&fit=crop' }, // Dark texture
                    { id: 'dark_2', imageUrl: 'https://images.unsplash.com/photo-1533035353717-3f6a989fe8d9?q=80&w=2070&auto=format&fit=crop' }, // Deep Blue
                    { id: 'dark_3', imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop' } // Abstract Dark
                ]
            }
        ]
    }
];

// Flat list for backward compatibility
export const EVENT_THEMES = THEME_CATEGORIES.flatMap(c => c.themes.flatMap(t =>
    t.variants.map(v => ({
        id: v.id,
        name: t.name,
        previewColor: '#000',
        backgroundColor: '#000',
        imageUrl: v.imageUrl,
        description: t.description,
        font: t.font
    }))
));
