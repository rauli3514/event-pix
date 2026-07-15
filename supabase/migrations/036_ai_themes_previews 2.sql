-- ============================================================
-- 036_ai_themes_previews.sql
-- Asigna preview_url local a cada tema de IA
-- Las imágenes están en /public/ai-themes/
-- ============================================================

-- Add preview_url column if missing
ALTER TABLE ai_themes ADD COLUMN IF NOT EXISTS preview_url text;

-- Update each theme with its preview image
UPDATE ai_themes SET preview_url = '/ai-themes/jugador-seleccion.jpg'        WHERE name = 'Jugador de la Selección';
UPDATE ai_themes SET preview_url = '/ai-themes/jugador-equipo-argentino.jpg'  WHERE name = 'Jugador de Equipo Argentino';
UPDATE ai_themes SET preview_url = '/ai-themes/jugador-equipo-uruguayo.jpg'   WHERE name = 'Jugador de Equipo Uruguayo';
UPDATE ai_themes SET preview_url = '/ai-themes/guerrero-vikingo.jpg'          WHERE name = 'Guerrero Vikingo';
UPDATE ai_themes SET preview_url = '/ai-themes/guerrero-espartano.jpg'        WHERE name = 'Guerrero Espartano';
UPDATE ai_themes SET preview_url = '/ai-themes/retrato-real.jpg'              WHERE name = 'Retrato Real';
UPDATE ai_themes SET preview_url = '/ai-themes/realeza-fantasia-epica.jpg'    WHERE name = 'Realeza Fantasía Épica';
UPDATE ai_themes SET preview_url = '/ai-themes/heroe-comic-retro.jpg'         WHERE name = 'Héroe Cómic Retro';
UPDATE ai_themes SET preview_url = '/ai-themes/estudiante-de-magia.jpg'       WHERE name = 'Estudiante de Magia';
UPDATE ai_themes SET preview_url = '/ai-themes/princesa-de-cuento.jpg'        WHERE name = 'Princesa de Cuento';
UPDATE ai_themes SET preview_url = '/ai-themes/capitan-pirata.jpg'            WHERE name = 'Capitán Pirata';
UPDATE ai_themes SET preview_url = '/ai-themes/gangster-retro.jpg'            WHERE name = 'Gangster Retro';
UPDATE ai_themes SET preview_url = '/ai-themes/fiesta-disco-70s.jpg'          WHERE name = 'Fiesta Disco 70s';
UPDATE ai_themes SET preview_url = '/ai-themes/vhs-retro-80s.jpg'             WHERE name = 'VHS Retro 80s';
UPDATE ai_themes SET preview_url = '/ai-themes/peaky-blinders.jpg'            WHERE name = 'Peaky Blinders';
UPDATE ai_themes SET preview_url = '/ai-themes/ancient-egypt-royalty.jpg'     WHERE name = 'Ancient Egypt Royalty';
UPDATE ai_themes SET preview_url = '/ai-themes/toon-3d.jpg'                   WHERE name = 'Toon 3D';
UPDATE ai_themes SET preview_url = '/ai-themes/caricatura-simpson.jpg'        WHERE name = 'Caricatura Simpson';
UPDATE ai_themes SET preview_url = '/ai-themes/heroe-mundo-arcade.jpg'        WHERE name = 'Héroe del Mundo Arcade';
UPDATE ai_themes SET preview_url = '/ai-themes/ladron-de-tralaleros.jpg'      WHERE name = 'Ladrón de Tralaleros';
UPDATE ai_themes SET preview_url = '/ai-themes/moana.jpg'                     WHERE name = 'Moana';
UPDATE ai_themes SET preview_url = '/ai-themes/gala-alfombra-roja.jpg'        WHERE name = 'Gala Alfombra Roja';
UPDATE ai_themes SET preview_url = '/ai-themes/moda-gucci.jpg'                WHERE name = 'Moda Gucci';
UPDATE ai_themes SET preview_url = '/ai-themes/paparazzi-nocturno.jpg'        WHERE name = 'Paparazzi Nocturno';
UPDATE ai_themes SET preview_url = '/ai-themes/vogue-cover.jpg'               WHERE name = 'Vogue Cover';
UPDATE ai_themes SET preview_url = '/ai-themes/green-fashion.jpg'             WHERE name = 'Green Fashion';
UPDATE ai_themes SET preview_url = '/ai-themes/lago-europeo-de-lujo.jpg'      WHERE name = 'Lago Europeo de Lujo';
UPDATE ai_themes SET preview_url = '/ai-themes/futuro-cyberpunk.jpg'          WHERE name = 'Futuro Cyberpunk';
UPDATE ai_themes SET preview_url = '/ai-themes/terminator.jpg'                WHERE name = 'Terminator';
UPDATE ai_themes SET preview_url = '/ai-themes/figura-coleccionable-3d.jpg'   WHERE name = 'Figura Coleccionable 3D';
UPDATE ai_themes SET preview_url = '/ai-themes/gaucho-argentino.jpg'          WHERE name = 'Gaucho Argentino';
UPDATE ai_themes SET preview_url = '/ai-themes/selfie-con-tiburon.jpg'        WHERE name = 'Selfie con Tiburón';
UPDATE ai_themes SET preview_url = '/ai-themes/polaroid-party.jpg'            WHERE name = 'Polaroid Party';
