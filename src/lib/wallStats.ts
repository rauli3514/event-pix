import { Submission } from '@/types';
import { isAnonymousAuthor } from '@/lib/guestSubmissions';

export interface RankRow {
    name: string;
    count: number;
    /** Última foto de esa persona, para mostrarla en el ranking */
    thumb: string;
}

export interface WallStats {
    photos: number;
    /** Personas distintas que subieron algo con nombre */
    guests: number;
    ranking: RankRow[];
}

/** Números para la pantalla, a partir de lo aprobado. La lista viene de más nueva a más vieja. */
export const getWallStats = (submissions: Submission[]): WallStats => {
    const approved = submissions.filter((s) => s.status === 'approved');
    const guests = new Set<string>();
    const byAuthor = new Map<string, RankRow>();
    let photos = 0;

    for (const s of approved) {
        const named = !isAnonymousAuthor(s.author);
        const key = named ? s.author!.trim().toLowerCase() : '';
        if (named) guests.add(key);
        if (s.type !== 'photo') continue;
        photos++;
        if (!named) continue;
        const row = byAuthor.get(key);
        if (row) row.count++;
        else byAuthor.set(key, { name: s.author!.trim(), count: 1, thumb: s.content });
    }

    const ranking = [...byAuthor.values()].sort((a, b) => b.count - a.count).slice(0, 5);
    return { photos, guests: guests.size, ranking };
};
