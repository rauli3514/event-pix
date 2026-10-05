-- Temáticas solo para Nano Banana (fal-ai/nano-banana/edit, ~US$0,04 por foto).
-- Nano Banana es muy bueno cambiando ropa y fondo conservando las caras, pero casi no
-- transforma la foto en otro estilo (acuarela, anime, plastilina…): esas se desactivan.
-- El Retrato al Óleo pasa a ser un disfraz de realeza barroca (foto real, no pintura).
-- Se agregan temáticas de disfraz y fondo. Navidad y Halloween quedan desactivadas
-- (de temporada): se prenden desde el panel. Re-ejecutable.

UPDATE public.ai_themes SET name = 'Realeza Barroca' WHERE name = 'Retrato al Óleo' AND NOT EXISTS (SELECT 1 FROM public.ai_themes WHERE name = 'Realeza Barroca');

UPDATE public.ai_themes SET is_active = false WHERE name IN ('Acuarela', 'Anime Japonés', 'Plastilina', 'Héroe Cómic Retro', 'Toon 3D', 'Figura Coleccionable 3D');

INSERT INTO public.ai_themes (name, category, emoji, max_people, prompt, negative_prompt, result_style, sort_order, is_default, is_active) VALUES
('Realeza Barroca', 'fantasia', '👑', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them as 17th century European royalty: kings and queens matching their own appearance, with velvet robes, ermine fur capes, jewels and golden crowns. Replace the background with a grand baroque palace hall with marble columns and red velvet drapes, warm candle light. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 17, true, true),
('Lejano Oeste', 'epocas', '🤠', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them as Wild West cowboys and cowgirls with leather vests, bandanas, cowboy hats and boots. Replace the background with a dusty western town main street with a wooden saloon at golden sunset. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 30, true, true),
('Fiesta Hawaiana', 'aventura', '🌺', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them in colorful Hawaiian shirts, flower leis and tropical flower crowns. Replace the background with a tropical beach at sunset with palm trees, tiki torches and turquoise sea. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 31, true, true),
('Samurái', 'epocas', '⚔️', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them as Japanese samurai warriors with traditional lacquered armor and katanas at the waist, without helmets so the faces stay visible. Replace the background with a Japanese temple garden with cherry blossoms falling. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 32, true, true),
('Piloto de Carreras', 'deportes', '🏎️', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them as racing drivers in colorful racing suits without sponsor logos, holding their helmets under the arm so the faces stay visible. Replace the background with a race track pit lane with a sleek race car behind them. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 33, true, true),
('Carnaval de Río', 'moda', '🎭', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them in spectacular Rio carnival costumes with colorful feathers, sequins and glitter. Replace the background with a festive carnival parade at night with confetti and bright lights. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 34, true, true),
('Navidad', 'aventura', '🎄', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them in cozy festive Christmas outfits with red sweaters and Santa hats. Replace the background with a warm living room with a decorated Christmas tree, fireplace and twinkling lights. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 35, true, false),
('Halloween', 'aventura', '🎃', 4,
 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them in fun Halloween costumes such as witches, vampires and wizards, not scary for children. Replace the background with a spooky but friendly night scene with carved pumpkins, full moon and bats. Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
 NULL, NULL, 36, true, false)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  emoji = EXCLUDED.emoji,
  max_people = EXCLUDED.max_people,
  prompt = EXCLUDED.prompt,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
