import { RawProfileData } from '../../types/profile.js';

export interface InstagramProvider {
  name: string;
  fetchProfile(username: string): Promise<RawProfileData>;
}

export class ProfileNotFoundError extends Error {
  constructor(username: string, platform: string) {
    super(`No se encontro el perfil publico @${username} en ${platform}.`);
    this.name = 'ProfileNotFoundError';
  }
}

export class ProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderConfigError';
  }
}
