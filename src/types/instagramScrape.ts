/** Forma que devuelve GET /api/instagram-scrape (ver api/_lib/instagramScraper.ts). */

export interface ScrapedSinglePostResponse {
  success: true;
  isProfile: false;
  shortcode: string;
  username: string;
  caption?: string;
  likes?: number;
  commentsCount?: number;
  comments?: Array<{ author: string; text: string }>;
  imageUrl?: string;
  videoUrl?: string;
  audioTrack?: string;
  followers?: string;
  url: string;
  type: 'reel' | 'image' | 'carousel';
}

export interface ScrapedProfilePost {
  shortcode: string;
  caption?: string;
  likes?: number;
  commentsCount?: number;
  imageUrl?: string;
  videoUrl?: string;
  timestamp?: string;
  type: 'reel' | 'image' | 'carousel';
  url: string;
}

export interface ScrapedProfileResponse {
  success: true;
  isProfile: true;
  username: string;
  followersCount?: number;
  followingCount?: number;
  mediaCount?: number;
  biography?: string;
  profilePicUrl?: string;
  posts: ScrapedProfilePost[];
}

export interface ScrapeErrorResponse {
  success: false;
  error: string;
}

export type InstagramScrapeResponse = ScrapedSinglePostResponse | ScrapedProfileResponse | ScrapeErrorResponse;
