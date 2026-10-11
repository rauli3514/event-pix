// Hoja de prueba de impresión a 300 dpi (10×15: 1200×1800): degradés, colores, tonos de
// piel, líneas finas y texto chico. Sirve para ver si la impresora imprime en calidad
// foto o en borrador (rayas, puntos, colores lavados).

export function buildPrintTestSheet(): string {
  const W = 1200;
  const H = 1800;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Cielo a atardecer: los degradés muestran el bandeado del modo borrador
  const sky = ctx.createLinearGradient(0, 0, 0, 900);
  sky.addColorStop(0, '#0b1a4a');
  sky.addColorStop(0.45, '#7a3cff');
  sky.addColorStop(0.75, '#ff2e93');
  sky.addColorStop(1, '#ffb347');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, 900);
  const sun = ctx.createRadialGradient(W / 2, 760, 20, W / 2, 760, 320);
  sun.addColorStop(0, 'rgba(255,245,200,1)');
  sun.addColorStop(1, 'rgba(255,245,200,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 400, W, 500);

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = '800 110px system-ui, sans-serif';
  ctx.fillText('EventPix', W / 2, 230);
  ctx.font = '500 44px system-ui, sans-serif';
  ctx.fillText('Prueba de calidad de impresión', W / 2, 300);

  // Gris neutro: debe salir sin tinte de color
  const gray = ctx.createLinearGradient(60, 0, W - 60, 0);
  gray.addColorStop(0, '#000');
  gray.addColorStop(1, '#fff');
  ctx.fillStyle = gray;
  ctx.fillRect(60, 940, W - 120, 90);

  // Colores puros y tonos de piel
  const colors = ['#00aeef', '#ec008c', '#fff200', '#ff0000', '#00a651', '#2e3192'];
  const skins = ['#ffe0c7', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a1e'];
  const cw = (W - 120) / colors.length;
  colors.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(60 + i * cw, 1060, cw - 8, 150); });
  skins.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(60 + i * cw, 1230, cw - 8, 150); });

  // Líneas finas (1 a 4 px) y texto chico: en borrador se cortan o se empastan
  ctx.fillStyle = '#fff';
  ctx.fillRect(60, 1410, W - 120, 330);
  ctx.strokeStyle = '#111';
  for (let i = 0; i < 40; i++) {
    ctx.lineWidth = 1 + (i % 4);
    const x = 90 + i * 13;
    ctx.beginPath();
    ctx.moveTo(x, 1440);
    ctx.lineTo(x, 1700);
    ctx.stroke();
  }
  ctx.fillStyle = '#111';
  ctx.textAlign = 'left';
  [40, 28, 20, 14, 10].forEach((size, i) => {
    ctx.font = `500 ${size}px system-ui, sans-serif`;
    ctx.fillText('Calidad foto 300 dpi · Aa Bb 123', 640, 1480 + i * 52);
  });
  return canvas.toDataURL('image/jpeg', 0.96);
}
