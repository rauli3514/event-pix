import { InstagramProvider } from './types.js';
import { PostMetric, PostType, RawProfileData } from '../../types/profile.js';

/** Hash simple y determinista para que el mismo @username siempre genere los mismos datos. */
function seedFromString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
}

function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POST_TYPES: PostType[] = ['reel', 'image', 'carousel'];

/**
 * Proveedor de desarrollo: genera datos de ejemplo deterministas (mismo @username
 * siempre da el mismo resultado) para poder levantar y probar la API sin depender
 * de credenciales de Meta/Apify. No hace ninguna llamada de red.
 */
export class MockInstagramProvider implements InstagramProvider {
  name = 'mock';

  async fetchProfile(username: string): Promise<RawProfileData> {
    const rand = mulberry32(seedFromString(username.toLowerCase()));

    const followerCount = Math.floor(1500 + rand() * 98000);
    const followingCount = Math.floor(100 + rand() * 900);
    const mediaCount = Math.floor(60 + rand() * 500);

    const posts: PostMetric[] = Array.from({ length: 15 }).map((_, idx) => {
      const daysAgo = idx * (1 + Math.floor(rand() * 3));
      const type = POST_TYPES[Math.floor(rand() * POST_TYPES.length)];
      const engagementBase = followerCount * (0.005 + rand() * 0.06);
      const likes = Math.round(engagementBase * (0.85 + rand() * 0.3));
      const comments = Math.round(likes * (0.01 + rand() * 0.05));

      return {
        id: `mock_${username}_${idx}`,
        type,
        caption: `Publicacion #${mediaCount - idx} de @${username}`,
        published_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
        likes,
        comments,
        url: `https://www.instagram.com/p/mock_${username}_${idx}/`,
        thumbnail_url: undefined,
      };
    });

    return {
      platform: 'instagram',
      username,
      follower_count: followerCount,
      following_count: followingCount,
      media_count: mediaCount,
      posts,
      fetched_at: new Date().toISOString(),
      source: 'mock',
    };
  }
}
