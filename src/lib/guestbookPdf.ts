import { jsPDF } from 'jspdf';
import { Submission } from '@/types';
import { isAnonymousAuthor } from '@/lib/guestSubmissions';

// "Libro de firmas" en PDF: tapa con una foto del evento, los mensajes de los
// invitados y las dedicatorias de las fotos (con su miniatura). Se usa para
// descargarlo desde el panel y para el álbum de Drive.

const W = 210;
const H = 297;
const M = 18; // margen
const VIOLET: [number, number, number] = [109, 40, 217];
const INK: [number, number, number] = [30, 27, 46];
const SOFT: [number, number, number] = [245, 243, 255];
const GRAY: [number, number, number] = [120, 113, 140];

// Las fuentes estándar del PDF solo tienen caracteres latinos: los emojis
// saldrían como símbolos raros, así que se sacan (las tildes y la ñ quedan).
const latin = (s: string) =>
    s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, '-')
        .replace(/[^\n\x20-\xFF]/g, '').replace(/[ \t]+/g, ' ').trim();

const authorName = (s: Submission) => (isAnonymousAuthor(s.author) ? 'Invitado' : latin(s.author!.trim()) || 'Invitado');
const hour = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

/** Foto recortada en cuadrado y achicada, para que el PDF no pese de más. */
async function thumb(url: string, size: number): Promise<string | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const bmp = await createImageBitmap(await res.blob());
        const side = Math.min(bmp.width, bmp.height);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        canvas.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
        return canvas.toDataURL('image/jpeg', 0.8);
    } catch {
        return null;
    }
}

export interface GuestbookContent {
    messages: Submission[];
    /** Fotos aprobadas con dedicatoria, con su número en el álbum (001, 002…) */
    dedications: { n: number; photo: Submission }[];
}

/** Mensajes y dedicatorias aprobados, en orden de llegada (misma numeración que el álbum). */
export const guestbookContent = (submissions: Submission[]): GuestbookContent => {
    const approved = submissions
        .filter((s) => s.status === 'approved')
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const dedications: GuestbookContent['dedications'] = [];
    let n = 0;
    for (const s of approved) {
        if (s.type !== 'photo') continue;
        n++;
        if (s.caption && latin(s.caption)) dedications.push({ n, photo: s });
    }
    return { messages: approved.filter((s) => s.type === 'message' && latin(s.content)), dedications };
};

export async function buildGuestbookPdf(opts: {
    submissions: Submission[];
    eventName: string;
    eventDate?: string | null;
}): Promise<jsPDF | null> {
    const { messages, dedications } = guestbookContent(opts.submissions);
    if (!messages.length && !dedications.length) return null;

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const eventName = latin(opts.eventName) || 'Nuestro evento';
    const dateLabel = new Date(opts.eventDate || Date.now()).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

    // ── Tapa ───────────────────────────────────────────────────────────────
    doc.setFillColor(30, 27, 75);
    doc.rect(0, 0, W, H, 'F');
    const coverPhoto = (dedications[0]?.photo) ?? opts.submissions.find((s) => s.status === 'approved' && s.type === 'photo');
    const cover = coverPhoto ? await thumb(coverPhoto.content, 900) : null;
    if (cover) {
        doc.setFillColor(255, 255, 255);
        doc.rect(W / 2 - 52, 48, 104, 104, 'F');
        doc.addImage(cover, 'JPEG', W / 2 - 48, 52, 96, 96);
    }
    doc.setTextColor(196, 181, 253);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('LIBRO DE FIRMAS', W / 2, cover ? 180 : 110, { align: 'center' });
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(30);
    const titleLines = doc.splitTextToSize(eventName, W - 2 * M);
    doc.text(titleLines, W / 2, cover ? 196 : 126, { align: 'center' });
    let cy = (cover ? 196 : 126) + titleLines.length * 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(13);
    doc.setTextColor(221, 214, 254);
    doc.text(dateLabel, W / 2, cy, { align: 'center' });
    cy += 9;
    const stats = [
        messages.length ? `${messages.length} ${messages.length === 1 ? 'mensaje' : 'mensajes'}` : '',
        dedications.length ? `${dedications.length} ${dedications.length === 1 ? 'dedicatoria' : 'dedicatorias'}` : '',
    ].filter(Boolean).join('  ·  ');
    doc.text(stats, W / 2, cy, { align: 'center' });
    doc.setFontSize(9);
    doc.setTextColor(167, 139, 250);
    doc.text('Hecho con EventPix', W / 2, H - 14, { align: 'center' });

    // ── Páginas interiores ─────────────────────────────────────────────────
    let y = 0;
    const newPage = () => {
        doc.addPage();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...GRAY);
        doc.text(eventName, M, 12);
        doc.setDrawColor(230, 225, 245);
        doc.line(M, 15, W - M, 15);
        y = 26;
    };
    const ensure = (h: number) => { if (y + h > H - 20) newPage(); };
    const sectionTitle = (title: string) => {
        ensure(24);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(...VIOLET);
        doc.text(title, M, y + 6);
        doc.setFillColor(...VIOLET);
        doc.rect(M, y + 9, 18, 1, 'F');
        y += 18;
    };

    newPage();

    if (messages.length) {
        sectionTitle('Mensajes');
        const textW = W - 2 * M - 22;
        for (const m of messages) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(12);
            const lines = doc.splitTextToSize(latin(m.content), textW);
            const h = lines.length * 5.6 + 20;
            ensure(h + 6);
            doc.setFillColor(...SOFT);
            doc.roundedRect(M, y, W - 2 * M, h, 3, 3, 'F');
            doc.setFillColor(...VIOLET);
            doc.rect(M, y, 1.6, h, 'F');
            doc.setFont('times', 'bold');
            doc.setFontSize(28);
            doc.setTextColor(196, 181, 253);
            doc.text('"', M + 5, y + 12);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(12);
            doc.setTextColor(...INK);
            doc.text(lines, M + 12, y + 10);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(...VIOLET);
            doc.text(authorName(m), M + 12, y + h - 5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...GRAY);
            doc.text(hour(m.created_at), W - M - 5, y + h - 5, { align: 'right' });
            y += h + 6;
        }
        y += 4;
    }

    if (dedications.length) {
        sectionTitle('Dedicatorias de las fotos');
        const img = 30;
        const textX = M + img + 10;
        const textW = W - M - textX - 4;
        // Miniaturas de a varias a la vez (no una por una)
        const thumbs = await Promise.all(dedications.map((d) => thumb(d.photo.content, 360)));
        dedications.forEach((d, i) => {
            doc.setFont('times', 'italic');
            doc.setFontSize(13);
            const lines = doc.splitTextToSize(`"${latin(d.photo.caption!)}"`, textW);
            const h = Math.max(img + 8, lines.length * 6 + 18);
            ensure(h + 6);
            doc.setFillColor(...SOFT);
            doc.roundedRect(M, y, W - 2 * M, h, 3, 3, 'F');
            if (thumbs[i]) doc.addImage(thumbs[i]!, 'JPEG', M + 4, y + 4, img, img);
            doc.setTextColor(...INK);
            doc.text(lines, textX, y + 11);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(...VIOLET);
            doc.text(authorName(d.photo), textX, y + h - 6);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...GRAY);
            doc.text(`Foto ${String(d.n).padStart(3, '0')}`, W - M - 5, y + h - 6, { align: 'right' });
            y += h + 6;
        });
    }

    // Números de página (sin contar la tapa)
    const pages = doc.getNumberOfPages();
    for (let p = 2; p <= pages; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...GRAY);
        doc.text(`${p - 1} / ${pages - 1}  ·  Hecho con EventPix`, W / 2, H - 10, { align: 'center' });
    }
    return doc;
}
