// Links de YouTube: reconocerlos y convertirlos al reproductor embebido.
// Un link común (youtube.com/watch, youtu.be) no se puede mostrar dentro de la
// pantalla: YouTube no deja abrir su página en un recuadro y queda en negro.
// El reproductor embebido (/embed/...) sí.

export interface YoutubeRef {
    videoId: string;
    playlistId: string;
}

const ID = /^[A-Za-z0-9_-]{6,}$/;

export function parseYoutube(raw?: string | null): YoutubeRef | null {
    const text = (raw || '').trim();
    if (!text) return null;
    let url: URL;
    try {
        url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
    } catch {
        return null;
    }
    const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
    let videoId = '';
    const playlistId = url.searchParams.get('list') || '';

    if (host === 'youtu.be') {
        videoId = url.pathname.split('/')[1] || '';
    } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        const [, first, second] = url.pathname.split('/');
        if (first === 'watch') videoId = url.searchParams.get('v') || '';
        else if (['embed', 'shorts', 'live', 'v'].includes(first)) videoId = second === 'videoseries' ? '' : second || '';
        else if (first !== 'playlist') return null;
    } else {
        return null;
    }

    if (videoId && !ID.test(videoId)) videoId = '';
    if (!videoId && !playlistId) return null;
    return { videoId, playlistId };
}

export const isYoutubeUrl = (raw?: string | null) => parseYoutube(raw) !== null;

// Dirección del reproductor embebido: arranca solo, se repite y sin carteles.
export function youtubeEmbedUrl(raw: string, opts: { muted?: boolean; controls?: boolean } = {}): string | null {
    const ref = parseYoutube(raw);
    if (!ref) return null;
    const params = new URLSearchParams({
        autoplay: '1',
        mute: opts.muted === false ? '0' : '1',
        controls: opts.controls ? '1' : '0',
        loop: '1',
        playsinline: '1',
        rel: '0',
        iv_load_policy: '3',
        cc_load_policy: '0',
    });
    if (ref.videoId) {
        // Para repetir un solo video, YouTube pide una lista con ese mismo video.
        if (ref.playlistId) params.set('list', ref.playlistId);
        else params.set('playlist', ref.videoId);
        return `https://www.youtube.com/embed/${ref.videoId}?${params}`;
    }
    params.set('list', ref.playlistId);
    return `https://www.youtube.com/embed/videoseries?${params}`;
}
