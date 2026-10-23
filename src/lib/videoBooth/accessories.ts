import { BUILT_IN_ACCESSORIES, drawAccessory, type Face } from '@/lib/faceFx';

// Accesorios que siguen la cara en la cabina de video: los del kiosco de fotos
// (se dibujan con su código, sin tocarlo) y otros propios de la cabina.
// Todo en unidades de "distancia entre ojos" (d); y negativo = hacia arriba.

type Draw = (ctx: CanvasRenderingContext2D, d: number) => void;

const star = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const rr = k % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
};

const heart = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.45);
  ctx.bezierCurveTo(x - s * 1.25, y - s * 0.35, x - s * 0.45, y - s * 1.15, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.45, y - s * 1.15, x + s * 1.25, y - s * 0.35, x, y + s * 0.45);
  ctx.closePath();
};

const OWN: Record<string, Draw> = {
  sunglasses: (ctx, d) => {
    ctx.fillStyle = '#0b0b10';
    ctx.strokeStyle = '#0b0b10';
    ctx.lineWidth = d * 0.08;
    for (const sx of [-0.52, 0.52]) {
      ctx.beginPath();
      ctx.moveTo(sx * d - d * 0.46, -d * 0.24);
      ctx.lineTo(sx * d + d * 0.46, -d * 0.24);
      ctx.quadraticCurveTo(sx * d + d * 0.44, d * 0.38, sx * d, d * 0.36);
      ctx.quadraticCurveTo(sx * d - d * 0.44, d * 0.38, sx * d - d * 0.46, -d * 0.24);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(-d * 1.05, -d * 0.24);
    ctx.lineTo(d * 1.05, -d * 0.24);
    ctx.stroke();
    // reflejo
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (const sx of [-0.52, 0.52]) {
      ctx.beginPath();
      ctx.ellipse(sx * d - d * 0.18, -d * 0.08, d * 0.1, d * 0.05, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  hearts: (ctx, d) => {
    ctx.fillStyle = 'rgba(255,46,147,0.85)';
    ctx.strokeStyle = '#ff2e93';
    ctx.lineWidth = d * 0.06;
    for (const sx of [-0.52, 0.52]) {
      heart(ctx, sx * d, d * 0.02, d * 0.42);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-d * 0.12, -d * 0.12);
    ctx.lineTo(d * 0.12, -d * 0.12);
    ctx.stroke();
  },
  tiara: (ctx, d) => {
    const y = -d * 1.25;
    ctx.fillStyle = '#e9e9f5';
    ctx.strokeStyle = '#b9bad6';
    ctx.lineWidth = d * 0.04;
    ctx.beginPath();
    ctx.moveTo(-d * 0.9, y + d * 0.25);
    for (let i = 0; i <= 8; i++) {
      const x = -d * 0.9 + (i * d * 1.8) / 8;
      const h = i === 4 ? 0.55 : i % 2 === 0 ? 0.32 : 0.12;
      ctx.lineTo(x, y + d * 0.25 - d * h);
    }
    ctx.lineTo(d * 0.9, y + d * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff2e93';
    ctx.beginPath();
    ctx.arc(0, y - d * 0.05, d * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#00d4ff';
    for (const sx of [-0.45, 0.45]) {
      ctx.beginPath();
      ctx.arc(sx * d, y + d * 0.06, d * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  cowboy: (ctx, d) => {
    const y = -d * 1.1;
    ctx.fillStyle = '#8b5a2b';
    ctx.strokeStyle = '#5e3a17';
    ctx.lineWidth = d * 0.05;
    // ala
    ctx.beginPath();
    ctx.ellipse(0, y, d * 1.55, d * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // copa
    ctx.beginPath();
    ctx.moveTo(-d * 0.62, y);
    ctx.quadraticCurveTo(-d * 0.7, y - d * 0.95, -d * 0.2, y - d * 0.9);
    ctx.quadraticCurveTo(0, y - d * 0.72, d * 0.2, y - d * 0.9);
    ctx.quadraticCurveTo(d * 0.7, y - d * 0.95, d * 0.62, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2b1a0b';
    ctx.fillRect(-d * 0.63, y - d * 0.2, d * 1.26, d * 0.14);
  },
  flowers: (ctx, d) => {
    const colors = ['#ff6fa8', '#ffd23f', '#c86bff', '#ff8a5b', '#7dffb3'];
    for (let i = 0; i < 9; i++) {
      const t = -1 + (i * 2) / 8;
      const x = t * d * 1.05;
      const y = -d * 1.05 + Math.abs(t) * d * 0.35;
      const r = d * 0.16;
      ctx.fillStyle = colors[i % colors.length];
      for (let p = 0; p < 5; p++) {
        const a = (p * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fff6c2';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  horns: (ctx, d) => {
    ctx.fillStyle = '#e0162b';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * d * 0.45, -d * 0.95);
      ctx.quadraticCurveTo(sx * d * 0.85, -d * 1.3, sx * d * 0.75, -d * 1.75);
      ctx.quadraticCurveTo(sx * d * 0.62, -d * 1.3, sx * d * 0.2, -d * 1.05);
      ctx.closePath();
      ctx.fill();
    }
  },
  halo: (ctx, d) => {
    ctx.save();
    ctx.strokeStyle = '#ffe680';
    ctx.lineWidth = d * 0.12;
    ctx.shadowColor = '#fff3b0';
    ctx.shadowBlur = d * 0.4;
    ctx.beginPath();
    ctx.ellipse(0, -d * 1.65, d * 0.75, d * 0.2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },
  cat: (ctx, d) => {
    for (const sx of [-1, 1]) {
      ctx.fillStyle = '#2b2b33';
      ctx.beginPath();
      ctx.moveTo(sx * d * 0.25, -d * 1.05);
      ctx.lineTo(sx * d * 0.85, -d * 1.75);
      ctx.lineTo(sx * d * 1.0, -d * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ff9ec7';
      ctx.beginPath();
      ctx.moveTo(sx * d * 0.42, -d * 1.05);
      ctx.lineTo(sx * d * 0.82, -d * 1.5);
      ctx.lineTo(sx * d * 0.88, -d * 0.98);
      ctx.closePath();
      ctx.fill();
    }
    // bigotes y nariz
    ctx.strokeStyle = 'rgba(30,30,30,0.85)';
    ctx.lineWidth = d * 0.03;
    for (const sx of [-1, 1]) {
      for (const dy of [-0.08, 0.04, 0.16]) {
        ctx.beginPath();
        ctx.moveTo(sx * d * 0.2, d * 0.85 + dy * d);
        ctx.lineTo(sx * d * 0.85, d * 0.8 + dy * d * 1.6);
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#ff6fa8';
    ctx.beginPath();
    ctx.arc(0, d * 0.72, d * 0.09, 0, Math.PI * 2);
    ctx.fill();
  },
  mask: (ctx, d) => {
    ctx.fillStyle = '#7b2ff7';
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = d * 0.05;
    ctx.beginPath();
    ctx.moveTo(-d * 1.1, -d * 0.1);
    ctx.quadraticCurveTo(-d * 0.9, -d * 0.55, -d * 0.4, -d * 0.4);
    ctx.quadraticCurveTo(0, -d * 0.25, d * 0.4, -d * 0.4);
    ctx.quadraticCurveTo(d * 0.9, -d * 0.55, d * 1.1, -d * 0.1);
    ctx.quadraticCurveTo(d * 0.9, d * 0.45, d * 0.35, d * 0.3);
    ctx.quadraticCurveTo(0, d * 0.15, -d * 0.35, d * 0.3);
    ctx.quadraticCurveTo(-d * 0.9, d * 0.45, -d * 1.1, -d * 0.1);
    ctx.closePath();
    // agujeros de los ojos
    for (const sx of [-0.5, 0.5]) {
      ctx.moveTo(sx * d + d * 0.24, 0);
      ctx.ellipse(sx * d, 0, d * 0.24, d * 0.15, 0, 0, Math.PI * 2, true);
    }
    ctx.fill('evenodd');
    ctx.stroke();
  },
  bow: (ctx, d) => {
    const y = -d * 1.3;
    ctx.fillStyle = '#ff2e93';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(sx * d * 0.5, y - d * 0.55, sx * d * 0.75, y - d * 0.1);
      ctx.quadraticCurveTo(sx * d * 0.55, y + d * 0.4, 0, y);
      ctx.fill();
    }
    ctx.fillStyle = '#c2126d';
    ctx.beginPath();
    ctx.arc(0, y, d * 0.13, 0, Math.PI * 2);
    ctx.fill();
  },
  starsHead: (ctx, d) => {
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = d * 0.03;
    for (let i = 0; i < 5; i++) {
      const t = -1 + (i * 2) / 4;
      star(ctx, t * d * 0.95, -d * 1.2 + Math.abs(t) * d * 0.3, d * (i === 2 ? 0.26 : 0.19));
      ctx.fill();
      ctx.stroke();
    }
  },
};

export const VIDEO_ACCESSORIES: { value: string; label: string }[] = [
  ...BUILT_IN_ACCESSORIES.map(a => ({ value: a.value as string, label: a.label })),
  { value: 'sunglasses', label: 'Lentes de sol' },
  { value: 'hearts', label: 'Anteojos corazón' },
  { value: 'tiara', label: 'Tiara' },
  { value: 'cowboy', label: 'Sombrero vaquero' },
  { value: 'flowers', label: 'Corona de flores' },
  { value: 'horns', label: 'Cuernitos' },
  { value: 'halo', label: 'Aureola' },
  { value: 'cat', label: 'Gatito' },
  { value: 'mask', label: 'Antifaz' },
  { value: 'bow', label: 'Moño' },
  { value: 'starsHead', label: 'Estrellas' },
];
export const accessoryLabel = (v?: string) => VIDEO_ACCESSORIES.find(a => a.value === v)?.label ?? 'Sin accesorio';

/** Sistema de la cara: origen entre los ojos, eje X hacia el otro ojo (como en el kiosco). */
function faceFrame(f: Face) {
  const a = f.rightEye.x <= f.leftEye.x ? f.rightEye : f.leftEye;
  const b = a === f.rightEye ? f.leftEye : f.rightEye;
  return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, angle: Math.atan2(b.y - a.y, b.x - a.x), d: Math.hypot(b.x - a.x, b.y - a.y) };
}

/** Dibuja un accesorio sobre una cara. */
export function drawVideoAccessory(ctx: CanvasRenderingContext2D, face: Face, value: string) {
  const own = OWN[value];
  if (!own) { drawAccessory(ctx, face, value); return; }
  const fr = faceFrame(face);
  if (fr.d < 4) return;
  ctx.save();
  ctx.translate(fr.cx, fr.cy);
  ctx.rotate(fr.angle);
  own(ctx, fr.d);
  ctx.restore();
}
