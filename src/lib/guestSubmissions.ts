// Datos que el celular del invitado recuerda entre envíos: su nombre (para no
// pedirlo cada vez) y los IDs de lo que subió, para avisarle cuando sale en
// pantalla. Todo en localStorage, envuelto en try/catch porque en modo
// incógnito o con el almacenamiento bloqueado puede fallar.

const NAME_KEY = 'eventpix_guest_name';
const MINE_KEY = (eventId: string) => `eventpix_my_submissions_${eventId}`;

// Pasado este tiempo dejamos de esperar la aprobación (quedó pendiente o fue rechazada).
const MAX_WAIT_MS = 2 * 60 * 60 * 1000;

export interface MySubmission {
    id: string;
    type: 'photo' | 'message' | 'audio';
    at: number;
}

export const getGuestName = (): string => {
    try {
        return localStorage.getItem(NAME_KEY) || '';
    } catch {
        return '';
    }
};

export const saveGuestName = (name: string) => {
    try {
        const clean = name.trim().slice(0, 40);
        if (clean) localStorage.setItem(NAME_KEY, clean);
    } catch {
        // sin almacenamiento: se vuelve a pedir la próxima vez
    }
};

/** "Invitado" es el valor por defecto viejo: en pantalla no lo mostramos. */
export const isAnonymousAuthor = (author?: string | null) =>
    !author || author.trim().toLowerCase() === 'invitado';

export const getMySubmissions = (eventId: string): MySubmission[] => {
    try {
        const raw = localStorage.getItem(MINE_KEY(eventId));
        const list: MySubmission[] = raw ? JSON.parse(raw) : [];
        return list.filter((s) => Date.now() - s.at < MAX_WAIT_MS);
    } catch {
        return [];
    }
};

const writeMySubmissions = (eventId: string, list: MySubmission[]) => {
    try {
        if (list.length) localStorage.setItem(MINE_KEY(eventId), JSON.stringify(list));
        else localStorage.removeItem(MINE_KEY(eventId));
    } catch {
        // ignorar
    }
};

export const rememberMySubmission = (eventId: string, submission: Omit<MySubmission, 'at'>) => {
    writeMySubmissions(eventId, [...getMySubmissions(eventId), { ...submission, at: Date.now() }]);
};

export const forgetMySubmissions = (eventId: string, ids: string[]) => {
    writeMySubmissions(eventId, getMySubmissions(eventId).filter((s) => !ids.includes(s.id)));
};
