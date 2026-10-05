-- Experiencias especiales en el panel (Temáticas IA): Portada Fashion IA, Caricatura con
-- Messi y Figurita. Tienen botón propio en el kiosco (no aparecen en Retrato Mágico) y
-- se marcan con result_style. Así se pueden ver, editar y probar desde el panel.
-- La Figurita solo quita el fondo: su prompt no se usa. Re-ejecutable.

UPDATE public.ai_themes SET category = 'especial', sort_order = -3 WHERE result_style = 'cover';

INSERT INTO public.ai_themes (name, category, emoji, max_people, prompt, negative_prompt, result_style, sort_order, is_default, is_active) VALUES
('Caricatura con Messi', 'especial', '🇦🇷', 4,
 'Restyle this photo as a vibrant, fun 3D caricature illustration. Keep the exact likeness of every person in the photo: same face shape, facial features, skin tone, hairstyle and expression, slightly exaggerated in a friendly caricature way but clearly recognizable. Do not remove anyone. Add Lionel Messi next to them as a caricature too. Everyone wears the Argentina national team jersey with white and sky-blue vertical stripes, celebrating a goal together inside a packed stadium with golden confetti in the air. Joyful, colorful. No text, no logos, no watermark.',
 NULL, 'caricatura', -2, true, true),
('Figurita (quitar fondo)', 'especial', '🃏', 1,
 'Quita el fondo de la foto (no usa prompt).',
 NULL, 'figurita', -1, true, true)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  emoji = EXCLUDED.emoji,
  result_style = EXCLUDED.result_style,
  sort_order = EXCLUDED.sort_order;
