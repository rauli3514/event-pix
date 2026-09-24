import { env } from '../../config/env.js';
import { InstagramProvider } from './types.js';
import { MockInstagramProvider } from './mockProvider.js';
import { MetaBusinessDiscoveryProvider } from './metaBusinessDiscoveryProvider.js';
import { ApifyInstagramProvider } from './apifyProvider.js';

export * from './types.js';

export function getInstagramProvider(): InstagramProvider {
  switch (env.instagramProvider) {
    case 'meta':
      return new MetaBusinessDiscoveryProvider();
    case 'apify':
      return new ApifyInstagramProvider();
    case 'mock':
    default:
      return new MockInstagramProvider();
  }
}
