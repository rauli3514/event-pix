-- Caricatura con Messi: más parecido a la persona real. La versión anterior hacía un
-- dibujo muy "Pixar" (ojos grandes, cara redondeada) y con mucha gente alrededor, así
-- la cara quedaba chica y genérica. Ahora: estilo 3D semirrealista con exageración
-- leve, encuadre de medio cuerpo con caras grandes, sin multitud adelante. Re-ejecutable.

UPDATE public.ai_themes
SET prompt = 'Turn this photo into a semi-realistic 3D caricature portrait. IDENTITY IS THE TOP PRIORITY: every person from the photo must be instantly recognizable as themselves. Keep each face exactly as in the photo: same face shape and proportions, same eyes and eye shape, eyebrows, nose, mouth and smile, same skin tone, same hairline and hairstyle, same beard or facial hair, same glasses if they wear them, same age and body type. Only a very light, friendly caricature exaggeration (slightly bigger head and smile); do not change their features, do not make them look younger, thinner or like a generic cartoon character, no oversized eyes. Keep everyone from the photo and add Lionel Messi standing right next to them, hugging and celebrating together, also as a recognizable semi-realistic 3D caricature. Everyone wears the Argentina national team jersey with white and sky-blue vertical stripes. Medium shot from the waist up, faces large and in sharp focus, centered. Background: a blurred packed stadium at night with golden confetti; no other people in the foreground. Bright, joyful, high detail. No text, no logos, no watermark.'
WHERE result_style = 'caricatura';
