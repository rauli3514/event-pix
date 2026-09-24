import { env } from '../../config/env.js';
import { PostMetric, RawProfileData } from '../../types/profile.js';
import { TikTokProvider } from './types.js';
import { ProfileNotFoundError, ProviderConfigError } from '../instagram/types.js';

/**
 * Forma esperada de cada item del dataset del actor de Apify
 * "clockworks/tiktok-scraper" (o equivalente) cuando se pide el perfil
 * completo de un usuario. Ajusta `mapApifyItem` si usas otro actor.
 */
interface ApifyTikTokItem {
  id?: string;
  text?: string; // caption
  createTimeISO?: string;
  webVideoUrl?: string;
  videoMeta?: { coverUrl?: string };
  diggCount?: number; // likes
  commentCount?: number;
  authorMeta?: {
    name?: string;
    fans?: number; // followers
    following?: number;
    video?: number; // total videos
  };
}

/**
 * Ejecuta el actor de scraping de TikTok en Apify de forma sincrona.
 * No requiere ninguna credencial del perfil analizado, solo tu APIFY_TOKEN.
 */
export class ApifyTikTokProvider implements TikTokProvider {
  name = 'apify';

  async fetchProfile(username: string): Promise<RawProfileData> {
    if (!env.apifyToken) {
      throw new ProviderConfigError('TIKTOK_PROVIDER=apify requiere APIFY_TOKEN en el .env.');
    }

    const actorId = env.apifyTiktokActorId;
    const url =
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items` +
      `?token=${encodeURIComponent(env.apifyToken)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profiles: [username],
        resultsPerPage: 15,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
      }),
    });

    if (!res.ok) {
      throw new Error(`Apify (${actorId}) devolvio HTTP ${res.status}: ${await res.text()}`);
    }

    const items = (await res.json()) as ApifyTikTokItem[];
    if (items.length === 0 || !items[0]?.authorMeta) {
      throw new ProfileNotFoundError(username, 'tiktok');
    }

    const author = items[0].authorMeta!;
    const posts: PostMetric[] = items.slice(0, 15).map((item, idx) => ({
      id: item.id || `${username}_${idx}`,
      type: 'video',
      caption: item.text,
      published_at: item.createTimeISO || new Date().toISOString(),
      likes: item.diggCount ?? 0,
      comments: item.commentCount ?? 0,
      url: item.webVideoUrl,
      thumbnail_url: item.videoMeta?.coverUrl,
    }));

    return {
      platform: 'tiktok',
      username: author.name || username,
      follower_count: author.fans ?? 0,
      following_count: author.following ?? 0,
      media_count: author.video ?? posts.length,
      posts,
      fetched_at: new Date().toISOString(),
      source: 'apify',
    };
  }
}
