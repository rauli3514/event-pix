-- ============================================================
-- 035_ai_themes_defaults.sql
-- Temas por defecto para Retrato Mágico (Kiosko de Fotos)
-- max_people: 1 = solo, 2 = hasta 2 personas
-- ============================================================

-- Add columns if they don't exist
ALTER TABLE ai_themes ADD COLUMN IF NOT EXISTS max_people integer NOT NULL DEFAULT 1;
ALTER TABLE ai_themes ADD COLUMN IF NOT EXISTS emoji text;
ALTER TABLE ai_themes ADD COLUMN IF NOT EXISTS category text DEFAULT 'retrato';
ALTER TABLE ai_themes ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Add unique constraint on name (needed for ON CONFLICT)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_themes_name_key' AND conrelid = 'ai_themes'::regclass
  ) THEN
    ALTER TABLE ai_themes ADD CONSTRAINT ai_themes_name_key UNIQUE (name);
  END IF;
END $$;

-- Insert default themes (upsert by name)
INSERT INTO ai_themes (name, prompt, max_people, emoji, category, is_default) VALUES

-- ── DEPORTES ──────────────────────────────────────────────────
('Jugador de la Selección',
 'Photorealistic portrait of a professional Argentina national football team player wearing the official white and light blue Adidas AFA jersey with three stars. Standing confidently in a packed stadium with bright floodlights, professional sports photography, ultra sharp, cinematic lighting. No text, no watermark.',
 1, '⚽', 'deportes', true),

('Jugador de Equipo Argentino',
 'Photorealistic portrait of a River Plate football player wearing the official white Adidas River Plate jersey with the diagonal red stripe. Standing on a football pitch inside a massive stadium filled with fans, dramatic stadium lighting. Professional sports photography, ultra sharp. No text, no watermark.',
 1, '🏟️', 'deportes', true),

('Jugador de Equipo Uruguayo',
 'Photorealistic portrait of a Peñarol football player wearing the official black and yellow vertical stripes Puma Peñarol jersey. Standing on a football pitch in a full stadium, dramatic lighting. Professional sports photography, ultra sharp. No text, no watermark.',
 1, '🏟️', 'deportes', true),

-- ── FANTASÍA / FICCIÓN ────────────────────────────────────────
('Guerrero Vikingo',
 'Photorealistic cinematic portrait of a fierce Viking warrior in full battle armor with fur cloak, leather straps and a large battle axe. Dramatic Nordic mountains and stormy sky background. Epic movie poster lighting, ultra detailed, sharp focus. No text, no watermark.',
 1, '🪓', 'fantasia', true),

('Guerrero Espartano',
 'Photorealistic cinematic portrait of a Spartan warrior wearing authentic ancient Greek bronze armor, red cape and plumed helmet, holding a shield and spear. Desert battlefield background at dusk. Epic dramatic lighting, ultra detailed. No text, no watermark.',
 1, '🛡️', 'fantasia', true),

('Retrato Real',
 'Photorealistic baroque oil painting style portrait of a European royal queen or king wearing authentic 17th century royal robes, jeweled crown and ermine fur cloak. Grand palace interior background with marble columns. Classical Old Masters painting style, ultra detailed. No text, no watermark.',
 2, '👑', 'fantasia', true),

('Realeza Fantasía Épica',
 'Photorealistic cinematic portrait of a fantasy king and queen in elaborate blue and silver fantasy royal armor and gown, standing before an enchanted misty forest castle. Magical blue light and floating particles, epic fantasy movie style, ultra detailed. No text, no watermark.',
 2, '🏰', 'fantasia', true),

('Héroe Cómic Retro',
 'Comic book illustration style portrait of a superhero in a classic 1960s American comic book art style, bright primary colors, bold black outlines, halftone dot shading, cityscape at night background. Pop art superhero aesthetic. No text, no watermark.',
 2, '🦸', 'fantasia', true),

('Estudiante de Magia',
 'Photorealistic portrait of Hogwarts students in Harry Potter style wizard robes with Gryffindor scarf and magic wand, standing in front of Hogwarts castle at golden hour with magical sparkles. Cinematic fantasy movie lighting. No text, no watermark.',
 2, '🪄', 'fantasia', true),

('Princesa de Cuento',
 'Photorealistic portrait of a fairy tale princess wearing an elegant white ball gown with a sparkling tiara, holding an enchanted red rose in a glass dome. Grand illuminated palace hall background with warm golden light. Cinematic fairy tale atmosphere. No text, no watermark.',
 1, '🌹', 'fantasia', true),

-- ── ÉPOCAS ────────────────────────────────────────────────────
('Capitán Pirata',
 'Photorealistic cinematic portrait of a Caribbean pirate captain in authentic 18th century pirate costume, worn leather coat, tricorn hat with feather, pistol and cutlass, standing on a wooden ship deck with sails and stormy ocean in background. Dramatic cinematographic lighting. No text, no watermark.',
 1, '🏴‍☠️', 'epocas', true),

('Gangster Retro',
 'Photorealistic cinematic portrait of a 1920s Chicago mob boss in a perfectly tailored pinstripe three-piece suit, fedora hat, holding a cigar. Dimly lit vintage speakeasy interior with warm amber lighting, globe and antique furniture in background. Film noir cinematography. No text, no watermark.',
 2, '🕴️', 'epocas', true),

('Fiesta Disco 70s',
 'Photorealistic portrait of a person wearing an iconic 1970s disco outfit with a silver sequin suit or glittery dress, striking a Saturday Night Fever dance pose inside a colorful disco club with mirror ball reflections and neon lights. Vibrant 70s aesthetic. No text, no watermark.',
 2, '🪩', 'epocas', true),

('VHS Retro 80s',
 'Photorealistic portrait of a person wearing iconic 1980s aerobics workout outfit with bright neon colors, leg warmers, and headband, doing a energetic pose in a retro gym with checkered floors and neon lighting. VHS film grain aesthetic, vibrant 80s colors. No text, no watermark.',
 2, '📼', 'epocas', true),

('Peaky Blinders',
 'Photorealistic cinematic portrait of a 1920s Birmingham gang member in the style of Peaky Blinders, wearing a tailored tweed flat cap, long overcoat and tie, standing in a misty cobblestone alley. Dark moody British period drama cinematography. No text, no watermark.',
 1, '🎩', 'epocas', true),

('Ancient Egypt Royalty',
 'Photorealistic cinematic portrait of an ancient Egyptian pharaoh wearing authentic white linen royal garments, gold collar jewelry and armbands, standing before the pyramids of Giza at dramatic sunset. Epic historical movie production quality. No text, no watermark.',
 1, '🐪', 'epocas', true),

-- ── ANIMACIÓN / ILUSTRACIÓN ───────────────────────────────────
('Toon 3D',
 'High quality 3D animation studio style portrait in Pixar and Disney CGI style. Expressive cartoon character with big eyes, smooth stylized skin, wearing colorful layered outfit with accessories. Vibrant cheerful town square background. Professional 3D render, cinematic lighting.',
 2, '🎬', 'animacion', true),

('Caricatura Simpson',
 'The person transformed into an official The Simpsons animated character with yellow skin, small round eyes, overbite, wearing casual Springfield clothing. Authentic Matt Groening art style, Springfield interior background. Official Simpsons show art quality. No text, no watermark.',
 2, '🍩', 'animacion', true),

('Héroe del Mundo Arcade',
 'The person transformed into a character inside a colorful retro arcade video game world, vibrant 3D animated style with Pac-Man ghosts, geometric neon platforms and pixel elements. Dynamic jumping action pose. Bright saturated game art style. No text, no watermark.',
 2, '🕹️', 'animacion', true),

('Ladrón de Tralaleros',
 'The child or person transformed into a mischievous cartoon character in a Bluey or Hey Arnold animated style, doing a funny superhero pose lifting a giant Lego shark, inside a colorful cartoon neighborhood. Flat 2D animation style with bright primary colors. No text, no watermark.',
 1, '🦈', 'animacion', true),

('Moana',
 'Photorealistic portrait of a Polynesian island warrior princess in the style of Disney Moana, wearing a traditional woven skirt and floral top, holding a carved oar staff, standing on dramatic volcanic ocean rocks with crashing waves and tropical mountains. Cinematic Disney live-action style. No text, no watermark.',
 1, '🌊', 'animacion', true),

-- ── MODA / LIFESTYLE ─────────────────────────────────────────
('Gala Alfombra Roja',
 'Photorealistic glamorous portrait of a celebrity at a Hollywood red carpet premiere, wearing a stunning couture evening gown or luxury designer suit. Dozens of professional photographers in background with camera flashes. High fashion magazine editorial style. No text, no watermark.',
 2, '🎬', 'moda', true),

('Moda Gucci',
 'Photorealistic high fashion editorial portrait for a luxury brand campaign, wearing an extravagant Gucci-style maximalist outfit with gold embroidery and rich jewel-toned colors. Ornate baroque floral wallpaper background. Vogue fashion magazine editorial lighting. No text, no watermark.',
 2, '👗', 'moda', true),

('Paparazzi Nocturno',
 'Photorealistic candid-style portrait of a celebrity shot by paparazzi photographers at night in a neon-lit city street, wearing stylish all-black casual luxury outfit with sunglasses. City neon reflections, motion blur of passing cars in background. Editorial press photography style. No text, no watermark.',
 1, '📸', 'moda', true),

('Vogue Cover',
 'Photorealistic Vogue magazine cover style portrait, subject wearing a sophisticated all-black structured blazer over silk blouse, neutral studio backdrop with subtle warm light. High fashion editorial photography, clean minimal composition, sharp focus. Magazine cover aesthetic. No text, no watermark.',
 1, '📰', 'moda', true),

('Green Fashion',
 'Photorealistic fashion editorial portrait with a fresh green monochromatic color palette, wearing an oversized white hoodie and sage green cargo pants. Minimalist lime green studio background with subtle neon ambient lighting. Contemporary streetwear editorial style. No text, no watermark.',
 1, '🌿', 'moda', true),

('Lago Europeo de Lujo',
 'Photorealistic portrait of a wealthy person relaxing on a luxury wooden motorboat on a pristine Alpine lake with snow-capped mountains and charming Italian lakeside village in background. Wearing a tailored linen blazer and sunglasses. Lifestyle luxury photography. No text, no watermark.',
 1, '⛵', 'moda', true),

-- ── SCI-FI / TECNOLOGÍA ─────────────────────────────────────
('Futuro Cyberpunk',
 'Photorealistic cinematic cyberpunk portrait, the person wearing a high-tech black tactical jacket with glowing neon blue and purple circuit accents and cybernetic implants visible. Rainy neon-lit Tokyo cyberpunk street background with Japanese neon signs. Blade Runner 2049 cinematography. No text, no watermark.',
 2, '🤖', 'scifi', true),

('Terminator',
 'Photorealistic cinematic portrait of a person as the Terminator, one half of the face is human and the other half reveals a chrome metallic endoskeleton skull with a glowing red eye. Dark dramatic studio lighting. Official Terminator movie production quality. No text, no watermark.',
 2, '⚙️', 'scifi', true),

('Figura Coleccionable 3D',
 'Photorealistic photograph of a limited edition collectible designer toy figure in packaging, the person''s exact face and likeness rendered as a high-quality plastic action figure in a collector box. Modern studio product photography. Unboxed figure visible next to the box. No text, no watermark.',
 1, '🧸', 'scifi', true),

-- ── NATURALEZA / AVENTURA ────────────────────────────────────
('Gaucho Argentino',
 'Photorealistic portrait of an authentic Argentine gaucho wearing traditional bombacha pants, colorful faja belt, rastra metal belt buckle and poncho, standing in the vast Pampas grasslands at golden hour with a dramatic sky. National geographic photography quality. No text, no watermark.',
 2, '🌾', 'aventura', true),

('Selfie con Tiburón',
 'Photorealistic underwater selfie photograph taken by the person using a GoPro action camera while a massive friendly great white shark swims directly behind them in clear tropical Caribbean water with colorful coral reef. Dramatic ultra-wide angle lens distortion. No text, no watermark.',
 1, '🦈', 'aventura', true),

('Polaroid Party',
 'Photorealistic warm cinematic portrait in the style of a 1990s disposable camera party photo, grainy film photography aesthetic, natural soft indoor party lighting with bokeh string lights in background, candid laughing pose. Film photography grain and warm tones. No text, no watermark.',
 2, '📷', 'aventura', true)

ON CONFLICT (name) DO UPDATE SET
  prompt      = EXCLUDED.prompt,
  max_people  = EXCLUDED.max_people,
  emoji       = EXCLUDED.emoji,
  category    = EXCLUDED.category,
  is_default  = EXCLUDED.is_default;
