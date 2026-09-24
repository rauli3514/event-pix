import { env } from '../../config/env.js';
import { PostMetric, PostType, RawProfileData } from '../../types/profile.js';
import { InstagramProvider, ProfileNotFoundError, ProviderConfigError } from './types.js';

/**
 * Forma esperada de cada item del dataset que devuelve el actor de Apify
 * "apify/instagram-profile-scraper" (o equivalente). Los actores de la
 * comunidad cambian de tanto en tanto su esquema de salida: si usas un actor
 * distinto, ajusta unicamente `mapApifyItem` mas abajo.
 */
interface ApifyInstagramItem {
  username?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  latestPosts?: Array<{
    id?: string;
    shortCode?: string;
    caption?: string;
    type?: string; // 'Image' | 'Video' | 'Sidecar'
    productType?: string; // 'feed' | 'clips' (reel) | 'igtv'
    timestamp?: string;
    likesCount?: number;
    commentsCount?: number;
    url?: string;
    displayUrl?: string;
  }>;
  error?: string;
}

function mapPostType(item: NonNullable<ApifyInstagramItem['latestPosts']>[number]): PostType {
  if (item.productType === 'clips') return 'reel';
  if (item.type === 'Sidecar') return 'carousel';
  if (item.type === 'Video') return 'video';
  return 'image';
}

/**
 * Ejecuta un actor de Apify (servicio de scraping de terceros, de pago) de forma
 * sincrona y toma el primer item del dataset resultante. No requiere ninguna
 * credencial del perfil analizado, solo tu propio APIFY_TOKEN.
 * Docs generales: https://docs.apify.com/api/v2#/reference/actors/run-actor-synchronously
 */
export class ApifyInstagramProvider implements InstagramProvider {
  name = 'apify';

  async fetchProfile(username: string): Promise<RawProfileData> {
    if (!env.apifyToken) {
      throw new ProviderConfigError('INSTAGRAM_PROVIDER=apify requiere APIFY_TOKEN en el .env.');
    }

    const actorId = env.apifyInstagramActorId;
    const url =
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items` +
      `?token=${encodeURIComponent(env.apifyToken)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usernames: [username],
        resultsLimit: 15,
      }),
    });

    if (!res.ok) {
      throw new Error(`Apify (${actorId}) devolvio HTTP ${res.status}: ${await res.text()}`);
    }

    const items = (await res.json()) as ApifyInstagramItem[];
    const item = items[0];

    if (!item || item.error || !item.username) {
      throw new ProfileNotFoundError(username, 'instagram');
    }

    const posts: PostMetric[] = (item.latestPosts || []).slice(0, 15).map((p, idx) => ({
      id: p.id || p.shortCode || `${username}_${idx}`,
      type: mapPostType(p),
      caption: p.caption,
      published_at: p.timestamp || new Date().toISOString(),
      likes: p.likesCount ?? 0,
      comments: p.commentsCount ?? 0,
      url: p.url,
      thumbnail_url: p.displayUrl,
    }));

    return {
      platform: 'instagram',
      username: item.username,
      follower_count: item.followersCount ?? 0,
      following_count: item.followsCount ?? 0,
      media_count: item.postsCount ?? posts.length,
      posts,
      fetched_at: new Date().toISOString(),
      source: 'apify',
    };
  }
}
