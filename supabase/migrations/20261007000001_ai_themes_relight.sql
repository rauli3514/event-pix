-- Temáticas de disfraz y fondo: la persona se vuelve a iluminar con la luz de la escena
-- nueva y el fondo queda con poca profundidad de campo, para que no parezca un recorte
-- pegado (la cara conservaba la luz plana de la foto original). Re-ejecutable.
UPDATE public.ai_themes
SET prompt = replace(prompt,
  ' Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.',
  ' Relight the people to match the new scene (same light direction, color and warmth) and use a shallow depth of field with a softly blurred background, so the result looks like one real professional photo taken there, not a collage. Photorealistic, high detail. No text, no logos, no watermark.')
WHERE prompt LIKE '%lighting consistent across the whole image. No text, no logos, no watermark.';
