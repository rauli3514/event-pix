import { env } from '../../config/env.js';
import { PostMetric, PostType, RawProfileData } from '../../types/profile.js';
import { InstagramProvider, ProfileNotFoundError, ProviderConfigError } from './types.js';

interface MetaMediaNode {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_product_type?: 'FEED' | 'REELS' | 'STORY';
  timestamp: string;
  like_count?: number;
  comments_count?: number;
  permalink?: string;
  media_url?: string;
  thumbnail_url?: string;
}

interface BusinessDiscoveryResponse {
  business_discovery?: {
    username: string;
    followers_count: number;
    follows_count: number;
    media_count: number;
    media?: { data: MetaMediaNode[] };
  };
  error?: { message: string; type: string; code: number };
}

function mapMediaType(node: MetaMediaNode): PostType {
  if (node.media_product_type === 'REELS') return 'reel';
  if (node.media_type === 'CAROUSEL_ALBUM') return 'carousel';
  if (node.media_type === 'VIDEO') return 'video';
  return 'image';
}

/**
 * Usa la Instagram Graph API "Business Discovery": permite consultar datos
 * PUBLICOS de cualquier cuenta Business/Creator de Instagram sin loguearse
 * como esa cuenta, usando el token/ID de TU propia cuenta Business conectada.
 * No requiere ni pide contrasenas del perfil analizado.
 * Docs: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/business-discovery
 *
 * Limitacion importante: solo funciona si el perfil consultado es una cuenta
 * Business o Creator (no personal) y es publica.
 */
export class MetaBusinessDiscoveryProvider implements InstagramProvider {
  name = 'meta';

  async fetchProfile(username: string): Promise<RawProfileData> {
    if (!env.metaAccessToken || !env.metaIgBusinessId) {
      throw new ProviderConfigError(
        'INSTAGRAM_PROVIDER=meta requiere META_ACCESS_TOKEN y META_IG_BUSINESS_ID en el .env.'
      );
    }

    const fields =
      `business_discovery.username(${encodeURIComponent(username)})` +
      '{username,followers_count,follows_count,media_count,' +
      'media.limit(15){id,caption,media_type,media_product_type,timestamp,like_count,comments_count,permalink,media_url,thumbnail_url}}';

    const url =
      `https://graph.facebook.com/${env.metaGraphVersion}/${env.metaIgBusinessId}` +
      `?fields=${fields}&access_token=${encodeURIComponent(env.metaAccessToken)}`;

    const res = await fetch(url);
    const data = (await res.json()) as BusinessDiscoveryResponse;

    if (!res.ok || data.error) {
      const message = data.error?.message || `Meta Graph API devolvio HTTP ${res.status}`;
      if (data.error?.code === 100) {
        throw new ProfileNotFoundError(username, 'instagram');
      }
      throw new Error(`Meta Business Discovery: ${message}`);
    }

    const bd = data.business_discovery;
    if (!bd) {
      throw new ProfileNotFoundError(username, 'instagram');
    }

    const posts: PostMetric[] = (bd.media?.data || []).map((node) => ({
      id: node.id,
      type: mapMediaType(node),
      caption: node.caption,
      published_at: node.timestamp,
      likes: node.like_count ?? 0,
      comments: node.comments_count ?? 0,
      url: node.permalink,
      thumbnail_url: node.thumbnail_url || node.media_url,
    }));

    return {
      platform: 'instagram',
      username: bd.username,
      follower_count: bd.followers_count,
      following_count: bd.follows_count,
      media_count: bd.media_count,
      posts,
      fetched_at: new Date().toISOString(),
      source: 'meta',
    };
  }
}
