/**
 * Opciones al azar dentro del prompt de una temática: {fondo A|fondo B|fondo C} se
 * reemplaza por una sola de las opciones, elegida al azar en cada foto. Lo que no
 * tenga "|" entre llaves queda igual. (La función generate-ai-photo hace lo mismo.)
 */
export const pickPromptVariants = (prompt: string) =>
  prompt.replace(/\{([^{}]*\|[^{}]*)\}/g, (_, options: string) => {
    const list = options.split('|').map(o => o.trim()).filter(Boolean);
    return list.length ? list[Math.floor(Math.random() * list.length)] : '';
  });
