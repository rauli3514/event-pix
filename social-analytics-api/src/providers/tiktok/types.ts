import { RawProfileData } from '../../types/profile.js';

export interface TikTokProvider {
  name: string;
  fetchProfile(username: string): Promise<RawProfileData>;
}
