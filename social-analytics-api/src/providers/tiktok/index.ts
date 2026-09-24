import { env } from '../../config/env.js';
import { TikTokProvider } from './types.js';
import { MockTikTokProvider } from './mockProvider.js';
import { ApifyTikTokProvider } from './apifyProvider.js';

export * from './types.js';

export function getTikTokProvider(): TikTokProvider {
  switch (env.tiktokProvider) {
    case 'apify':
      return new ApifyTikTokProvider();
    case 'mock':
    default:
      return new MockTikTokProvider();
  }
}
