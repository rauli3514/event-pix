import 'dotenv/config';

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

export const env = {
  port: Number(process.env.PORT) || 4000,

  anthropicApiKey: optional('ANTHROPIC_API_KEY'),

  instagramProvider: (optional('INSTAGRAM_PROVIDER') || 'mock') as 'mock' | 'meta' | 'apify',
  tiktokProvider: (optional('TIKTOK_PROVIDER') || 'mock') as 'mock' | 'apify',

  metaAccessToken: optional('META_ACCESS_TOKEN'),
  metaIgBusinessId: optional('META_IG_BUSINESS_ID'),
  metaGraphVersion: optional('META_GRAPH_VERSION') || 'v21.0',

  apifyToken: optional('APIFY_TOKEN'),
  apifyInstagramActorId: optional('APIFY_INSTAGRAM_ACTOR_ID') || 'apify~instagram-profile-scraper',
  apifyTiktokActorId: optional('APIFY_TIKTOK_ACTOR_ID') || 'clockworks~tiktok-scraper',
};
