/** Forma que devuelve GET /api/profile-analysis (ver api/_lib/instagramScraper.ts). */
export interface TopReel {
  id: string;
  url: string;
  caption?: string;
  views?: number;
  likes: number;
  comments: number;
  engagement_rate: number;
  type: 'reel' | 'image' | 'carousel';
}

export interface ProfileAnalysisResponse {
  success: true;
  profile: {
    username: string;
    followers: number;
    biography?: string;
    profile_pic?: string;
  };
  top_reels: TopReel[];
  winning_patterns: string[];
}
