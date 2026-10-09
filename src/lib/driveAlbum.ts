import { Submission } from '@/types';
import { isAnonymousAuthor } from '@/lib/guestSubmissions';
import { importToDrive, type DriveImportResult } from '@/lib/driveAdmin';

// "Enviar álbum a Drive": lo aprobado del muro (fotos, audios, mensajes y
// dedicatorias) va a la carpeta del evento en Drive, a través del Apps Script
// del kiosco. Se manda en tandas chicas para no pasar el límite de tiempo del
// script, y los archivos que ya están se saltean (se puede reintentar).

const BATCH = 8;
export const MESSAGES_FILE = 'Mensajes y dedicatorias.txt';

export interface AlbumFile { url: string; name: string }

const pad = (n: number) => String(n).padStart(3, '0');
// Caracteres que no conviene tener en nombres de archivo
const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
const authorOf = (s: Submission) => (isAnonymousAuthor(s.author) ? 'Invitado' : clean(s.author!) || 'Invitado');

const extOf = (url: string, fallback: string) => {
    const m = url.split('?')[0].match(/\.(jpe?g|png|webp|gif|heic|webm|mp3|m4a|ogg|wav|mp4)$/i);
    return m ? m[1].toLowerCase() : fallback;
};

const time = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

/** Arma la lista de archivos y el texto de mensajes, en orden de llegada. */
export const buildAlbum = (submissions: Submission[], eventName: string) => {
    const approved = submissions
        .filter((s) => s.status === 'approved')
        .sort((a, b) => a.created_at.localeCompare(b.created_at));

    const files: AlbumFile[] = [];
    const captions: string[] = [];
    let photoN = 0;
    let audioN = 0;

    for (const s of approved) {
        if (s.type === 'photo') {
            photoN++;
            const name = `${pad(photoN)} - ${authorOf(s)}.${extOf(s.content, 'jpg')}`;
            files.push({ url: s.content, name });
            if (s.caption) captions.push(`Foto ${pad(photoN)} — ${authorOf(s)}: “${s.caption}”`);
        } else if (s.type === 'audio' && s.content) {
            audioN++;
            files.push({ url: s.content, name: `Audio ${pad(audioN)} - ${authorOf(s)}.${extOf(s.content, 'webm')}` });
        }
    }

    const messages = approved
        .filter((s) => s.type === 'message')
        .map((s) => `— ${isAnonymousAuthor(s.author) ? 'Invitado' : s.author!.trim()} (${time(s.created_at)})\n${s.content}`);

    let text: string | null = null;
    if (messages.length || captions.length) {
        const parts = [`Mensajes y dedicatorias — ${eventName}`, `Generado por EventPix el ${new Date().toLocaleDateString('es-AR')}`];
        if (messages.length) parts.push('', 'MENSAJES', '', messages.join('\n\n'));
        if (captions.length) parts.push('', 'DEDICATORIAS DE LAS FOTOS', '', captions.join('\n'));
        text = parts.join('\n') + '\n';
    }

    return { files, text, photos: photoN, audios: audioN, messages: messages.length };
};

export interface ExportResult extends DriveImportResult { total: number }

export async function exportAlbumToDrive(opts: {
    eventId: string;
    submissions: Submission[];
    eventName: string;
    folder: string;
    shareFolder: boolean;
    onProgress?: (done: number, total: number) => void;
}): Promise<ExportResult> {
    const { files, text } = buildAlbum(opts.submissions, opts.eventName);
    const texts = text ? [{ name: MESSAGES_FILE, content: text }] : [];
    const result: ExportResult = { folderUrl: '', saved: 0, skipped: 0, failed: [], shared: false, total: files.length };

    // Siempre al menos un pedido (aunque no haya archivos) para crear la carpeta y el texto
    const batches: AlbumFile[][] = [];
    for (let i = 0; i < files.length; i += BATCH) batches.push(files.slice(i, i + BATCH));
    if (batches.length === 0) batches.push([]);

    let done = 0;
    opts.onProgress?.(0, files.length);
    for (let i = 0; i < batches.length; i++) {
        const last = i === batches.length - 1;
        const res = await importToDrive({
            event_id: opts.eventId,
            folder: opts.folder,
            files: batches[i],
            // El texto y el permiso de la carpeta van en el último pedido
            texts: last ? texts : [],
            shareFolder: last && opts.shareFolder,
        });
        result.folderUrl = res.folderUrl;
        result.saved += res.saved;
        result.skipped += res.skipped;
        result.failed.push(...res.failed);
        result.shared = res.shared;
        done += batches[i].length;
        opts.onProgress?.(done, files.length);
    }
    return result;
}
