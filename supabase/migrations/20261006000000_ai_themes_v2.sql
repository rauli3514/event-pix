-- Temáticas de IA v2, pensadas para los modelos de edición de fal.ai (nano-banana/edit), que EDITAN la foto real
-- en vez de generar una nueva: los prompts son instrucciones de edición que conservan
-- las caras. Re-ejecutable. Las que se quitan quedan desactivadas (is_active = false),
-- no borradas, por si se quieren volver a usar.
--
-- result_style = 'cover': el resultado de la IA va dentro de la tapa de revista
-- (Portada Fashion) con los textos de Ajustes del equipo.

ALTER TABLE public.ai_themes ADD COLUMN IF NOT EXISTS result_style TEXT;
ALTER TABLE public.ai_themes ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- Renombradas (conservan su imagen de muestra)
UPDATE public.ai_themes SET name = 'Realeza de Cuento' WHERE name = 'Princesa de Cuento' AND NOT EXISTS (SELECT 1 FROM public.ai_themes WHERE name = 'Realeza de Cuento');
UPDATE public.ai_themes SET name = 'Faraón de Egipto' WHERE name = 'Ancient Egypt Royalty' AND NOT EXISTS (SELECT 1 FROM public.ai_themes WHERE name = 'Faraón de Egipto');
UPDATE public.ai_themes SET name = 'Moda de Lujo' WHERE name = 'Moda Gucci' AND NOT EXISTS (SELECT 1 FROM public.ai_themes WHERE name = 'Moda de Lujo');
UPDATE public.ai_themes SET name = 'Portada Fashion IA' WHERE name = 'Vogue Cover' AND NOT EXISTS (SELECT 1 FROM public.ai_themes WHERE name = 'Portada Fashion IA');
UPDATE public.ai_themes SET name = 'Retrato al Óleo' WHERE name = 'Retrato Real' AND NOT EXISTS (SELECT 1 FROM public.ai_themes WHERE name = 'Retrato al Óleo');
UPDATE public.ai_themes SET name = 'Jugador de River' WHERE name = 'Jugador de Equipo Argentino' AND NOT EXISTS (SELECT 1 FROM public.ai_themes WHERE name = 'Jugador de River');

-- Se quitan (desactivadas)
UPDATE public.ai_themes SET is_active = false WHERE name IN ('Jugador de Fútbol', 'Estilo Cyberpunk', 'Gala de Lujo', 'Peaky Blinders', 'Paparazzi Nocturno', 'Caricatura Simpson', 'Ladrón de Tralaleros', 'Héroe del Mundo Arcade', 'Terminator', 'Selfie con Tiburón', 'Polaroid Party', 'Green Fashion', 'Lago Europeo de Lujo', 'Moana', 'Jugador de Equipo Uruguayo');

-- Temáticas activas con sus prompts nuevos
INSERT INTO public.ai_themes (name, category, emoji, max_people, prompt, negative_prompt, result_style, sort_order, is_default, is_active) VALUES
('Jugador de la Selección', 'deportes', '⚽', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them as professional players of the Argentina national football team: white and sky-blue vertical striped jersey, black shorts. Replace the background with the pitch of a packed football stadium at night, bright floodlights and a blurred crowd. Official team portrait look. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 1, true, true),
('Jugador de River', 'deportes', '⚪', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them as professional football players wearing a white jersey with a red diagonal sash across the chest and black shorts. Replace the background with the pitch of a packed stadium full of fans with red and white flags, night floodlights. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 2, true, true),
('Jugador de Boca', 'deportes', '🔵', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them as professional football players wearing a dark navy blue jersey with a wide horizontal golden-yellow band across the chest and navy shorts. Replace the background with the pitch of a packed stadium full of fans with blue and gold flags, night floodlights. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 3, true, true),
('Guerrero Vikingo', 'fantasia', '🪓', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them as fierce Viking warriors with leather and chainmail armor, fur cloaks and battle axes. Replace the background with dramatic Nordic mountains and a stormy sky. Epic movie poster lighting. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 4, true, true),
('Guerrero Espartano', 'fantasia', '🛡️', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them as ancient Spartan warriors with bronze armor, red capes and crested helmets held under the arm, so the face stays fully visible. Replace the background with a battlefield at golden dusk. Epic cinematic lighting. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 5, true, true),
('Realeza Fantasía Épica', 'fantasia', '🏰', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them as fantasy royalty, each person as a king or queen that matches their own appearance, with ornate blue and silver armor or gowns and delicate crowns. Replace the background with an enchanted misty castle with soft magical light and floating sparkles. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 6, true, true),
('Realeza de Cuento', 'fantasia', '🌹', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them as fairy tale royalty, each person as a prince or princess that matches their own appearance: elegant ball gowns or royal suits, sparkling tiaras or crowns. Replace the background with a grand golden palace ballroom with chandeliers and warm light. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 7, true, true),
('Estudiante de Magia', 'fantasia', '🪄', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them as students of a wizard school with black robes, striped house scarves and magic wands. Replace the background with the courtyard of a medieval stone castle at golden hour with floating candles and magical sparkles. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 8, true, true),
('Superhéroe de Película', 'fantasia', '🦸', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them as original movie superheroes with sleek armored suits and flowing capes, without any existing emblem. Replace the background with a city skyline at sunset seen from a rooftop. Blockbuster movie poster lighting. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 9, true, true),
('Capitán Pirata', 'epocas', '🏴‍☠️', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them as 18th century Caribbean pirate captains with worn leather coats, tricorn hats and sashes. Replace the background with the deck of a wooden pirate ship with sails and a stormy ocean at sunset. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 10, true, true),
('Gangster Retro', 'epocas', '🕴️', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them in 1920s gangster style: tailored pinstripe suits and fedora hats for men, elegant beaded flapper dresses and pearls for women. Replace the background with a dim vintage speakeasy bar with warm amber light. Film noir mood. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 11, true, true),
('Gran Gatsby', 'epocas', '🥂', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them for a Roaring Twenties gala: black tuxedos with bow ties for men, sequined art deco dresses with feather headbands for women. Replace the background with a luxurious art deco ballroom with gold details, champagne tower and confetti. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 12, true, true),
('Fiesta Disco 70s', 'epocas', '🪩', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them in 1970s disco outfits: shiny sequined suits, wide collars, glittery dresses and flared trousers. Replace the background with a colorful disco club with a mirror ball, light reflections and an illuminated dance floor. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 13, true, true),
('VHS Retro 80s', 'epocas', '📼', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them in 1980s neon outfits: bright aerobics clothes, leg warmers, headbands and oversized jackets. Replace the background with a retro neon gym or arcade. Add subtle VHS film grain and vibrant 80s colors. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 14, true, true),
('Faraón de Egipto', 'epocas', '🐪', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them as ancient Egyptian royalty with white linen garments, golden collars, armbands and a royal headdress. Replace the background with the pyramids of Giza at a dramatic golden sunset. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 15, true, true),
('Gaucho Argentino', 'epocas', '🌾', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them as traditional Argentine gauchos: bombacha pants, wide leather belt with silver coins (rastra), colorful sash, poncho and boina or hat; women may wear a long country dress with a poncho. Replace the background with the vast Pampas grasslands at golden hour with a dramatic sky. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 16, true, true),
('Retrato al Óleo', 'arte', '🖼️', 4,
 'Restyle this photo as a classical 17th century royal oil painting. Keep the exact likeness of every person: same face shape, facial features, skin tone, hairstyle and expression, so each one is clearly recognizable. Keep the same people, poses and composition. Dress them in baroque royal robes with ermine fur and jewels, with a dark palace background with columns and velvet drapes. Visible brush strokes, Old Masters lighting. No text, no logos, no watermark.',
 NULL, NULL, 17, true, true),
('Acuarela', 'arte', '🎨', 4,
 'Restyle this photo as a delicate watercolor painting on textured paper. Keep the exact likeness of every person: same face shape, facial features, skin tone, hairstyle and expression, so each one is clearly recognizable. Keep the same people, poses and composition. Soft washes of color, loose brush strokes, white paper edges, gentle pastel tones. No text, no logos, no watermark.',
 NULL, NULL, 18, true, true),
('Anime Japonés', 'arte', '🌸', 4,
 'Restyle this photo as a hand-drawn Japanese anime film illustration. Keep the exact likeness of every person: same face shape, facial features, skin tone, hairstyle and expression, so each one is clearly recognizable. Keep the same people, poses and composition. Soft cel shading, expressive eyes that still match each person, lush painted background with soft clouds. No text, no logos, no watermark.',
 NULL, NULL, 19, true, true),
('Toon 3D', 'arte', '🎬', 4,
 'Restyle this photo as a high quality 3D animated movie still. Keep the exact likeness of every person: same face shape, facial features, skin tone, hairstyle and expression, so each one is clearly recognizable. Keep the same people, poses and composition. Stylized 3D characters with slightly larger eyes but the same recognizable features, soft cinematic lighting, cheerful colorful background. No text, no logos, no watermark.',
 NULL, NULL, 20, true, true),
('Plastilina', 'arte', '🧱', 4,
 'Restyle this photo as a stop-motion claymation scene. Keep the exact likeness of every person: same face shape, facial features, skin tone, hairstyle and expression, so each one is clearly recognizable. Keep the same people, poses and composition. Every person becomes a handmade plasticine figure with visible fingerprints and clay texture, in a miniature handmade set. No text, no logos, no watermark.',
 NULL, NULL, 21, true, true),
('Héroe Cómic Retro', 'arte', '💥', 4,
 'Restyle this photo as a 1960s American comic book illustration. Keep the exact likeness of every person: same face shape, facial features, skin tone, hairstyle and expression, so each one is clearly recognizable. Keep the same people, poses and composition. Bold black ink outlines, halftone dots, bright primary colors and a dramatic city background. No text, no logos, no watermark.',
 NULL, NULL, 22, true, true),
('Gala Alfombra Roja', 'moda', '🎬', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them in glamorous red carpet outfits: couture evening gowns or luxury tailored tuxedos. Replace the background with a movie premiere red carpet with a step-and-repeat wall and many photographers with camera flashes. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 23, true, true),
('Moda de Lujo', 'moda', '👗', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them in extravagant maximalist luxury fashion with gold embroidery, rich jewel-tone fabrics and statement jewelry. Replace the background with an ornate baroque wallpaper. High fashion editorial lighting. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 24, true, true),
('Portada Fashion IA', 'moda', '📰', 2,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them for a high fashion magazine shoot: sophisticated designer outfits, styled hair, subtle glam makeup. Replace the background with a clean seamless studio backdrop in a soft neutral tone, professional beauty lighting, framed from the waist up with empty space above the heads. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, 'cover', 25, true, true),
('Estrella de Rock', 'moda', '🎸', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them as rock stars with leather jackets, band t-shirts without text and electric guitars or microphones. Replace the background with a huge concert stage with colorful spotlights, smoke and a cheering crowd. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 26, true, true),
('Astronauta', 'aventura', '🚀', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them in white NASA-style astronaut spacesuits without helmets, so their faces stay fully visible, without any flags or text. Replace the background with the surface of the Moon with the Earth rising in a black starry sky. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 27, true, true),
('Futuro Cyberpunk', 'scifi', '🤖', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them in futuristic black tech jackets with glowing neon blue and purple accents. Replace the background with a rainy neon-lit futuristic city street at night with glowing signs without readable text. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 28, true, true),
('Figura Coleccionable 3D', 'scifi', '🧸', 1,
 'Restyle this photo as a photo of a collectible plastic action figure of the main person, standing next to its open transparent collector box on a desk. Keep the exact likeness of every person: same face shape, facial features, skin tone, hairstyle and expression, so each one is clearly recognizable. Keep the same people, poses and composition. The figure has the same face, hairstyle and clothes as the person, glossy painted plastic finish, studio product photography. No text, no logos, no watermark.',
 NULL, NULL, 29, true, true)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  emoji = EXCLUDED.emoji,
  max_people = EXCLUDED.max_people,
  prompt = EXCLUDED.prompt,
  negative_prompt = NULL,
  result_style = EXCLUDED.result_style,
  sort_order = EXCLUDED.sort_order,
  is_default = true,
  is_active = true;
