import { TikTokProvider } from './types.js';
import { PostMetric, RawProfileData } from '../../types/profile.js';

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

/** Igual que el mock de Instagram: datos deterministas de ejemplo, sin red. */
export class MockTikTokProvider implements TikTokProvider {
  name = 'mock';

  async fetchProfile(username: string): Promise<RawProfileData> {
    const rand = mulberry32(seedFromString(`tiktok_${username.toLowerCase()}`));

    const followerCount = Math.floor(3000 + rand() * 250000);
    const followingCount = Math.floor(50 + rand() * 500);
    const videoCount = Math.floor(40 + rand() * 300);

    const posts: PostMetric[] = Array.from({ length: 15 }).map((_, idx) => {
      const daysAgo = idx * (1 + Math.floor(rand() * 2));
      const engagementBase = followerCount * (0.01 + rand() * 0.15);
      const likes = Math.round(engagementBase * (0.8 + rand() * 0.4));
      const comments = Math.round(likes * (0.005 + rand() * 0.03));

      return {
        id: `mock_tiktok_${username}_${idx}`,
        type: 'video',
        caption: `Video #${videoCount - idx} de @${username}`,
        published_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
        likes,
        comments,
        url: `https://www.tiktok.com/@${username}/video/mock_${idx}`,
        thumbnail_url: undefined,
      };
    });

    return {
      platform: 'tiktok',
      username,
      follower_count: followerCount,
      following_count: followingCount,
      media_count: videoCount,
      posts,
      fetched_at: new Date().toISOString(),
      source: 'mock',
    };
  }
}
