/**
 * Ingestion Layer de Instagram para los endpoints /api/instagram-scrape y
 * /api/instagram-transcribe. Usa un actor de Apify (servicio de terceros) para
 * traer datos PUBLICOS via el @username o el link del post/perfil, sin pedir
 * ni usar contrasenas de la cuenta consultada.
 *
 * Requiere APIFY_TOKEN en las variables de entorno del servidor. Si no esta
 * configurado, las funciones devuelven `configured: false` en vez de fallar
 * con datos simulados — este endpoint alimenta datos reales de negocio, a
 * diferencia del modo `mock` de social-analytics-api.
 */

import { getErrorMessage } from './errors.js';

export interface ScrapedComment {
  author: string;
  text: string;
}

export interface ScrapedPost {
  shortcode: string;
  caption?: string;
  likes?: number;
  commentsCount?: number;
  views?: number;
  comments?: ScrapedComment[];
  imageUrl?: string;
  videoUrl?: string;
  audioTrack?: string;
  timestamp?: string;
  type: 'reel' | 'image' | 'carousel';
  url: string;
}

export interface ScrapedSinglePost extends ScrapedPost {
  success: true;
  isProfile: false;
  username: string;
  followers?: string;
}

export interface ScrapedProfile {
  success: true;
  isProfile: true;
  username: string;
  followersCount?: number;
  followingCount?: number;
  mediaCount?: number;
  biography?: string;
  profilePicUrl?: string;
  posts: ScrapedPost[];
}

export interface ScrapeNotConfigured {
  success: false;
  configured: false;
  error: string;
}

export interface ScrapeFailed {
  success: false;
  configured: true;
  error: string;
}

export type ScrapeResult = ScrapedSinglePost | ScrapedProfile | ScrapeNotConfigured | ScrapeFailed;

/** true si la URL apunta a un post/reel especifico (no al perfil en si). */
export function isSinglePostUrl(url: string): boolean {
  return /\/(p|reel|tv)\//i.test(url);
}

/** Extrae el @username de una URL de perfil o de un handle suelto ("@user" o "user"). */
export function extractUsername(input: string): string {
  const trimmed = input.trim().replace(/^@/, '');
  const match = trimmed.match(/instagram\.com\/([^/?#]+)/i);
  if (match) return match[1];
  return trimmed;
}

interface ApifyPostNode {
  id?: string;
  shortCode?: string;
  caption?: string;
  type?: string; // 'Image' | 'Video' | 'Sidecar'
  productType?: string; // 'clips' (reel) | 'feed'
  timestamp?: string;
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  url?: string;
  displayUrl?: string;
  videoUrl?: string;
  musicInfo?: { song_name?: string; artist_name?: string };
  latestComments?: Array<{ ownerUsername?: string; text?: string }>;
}

interface ApifyProfileItem {
  username?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  biography?: string;
  profilePicUrl?: string;
  latestPosts?: ApifyPostNode[];
  error?: string;
}

function mapPostType(node: ApifyPostNode): ScrapedPost['type'] {
  if (node.productType === 'clips') return 'reel';
  if (node.type === 'Sidecar') return 'carousel';
  return 'reel';
}

function mapPost(node: ApifyPostNode): ScrapedPost {
  return {
    shortcode: node.shortCode || node.id || '',
    caption: node.caption,
    likes: node.likesCount,
    commentsCount: node.commentsCount,
    views: node.videoViewCount ?? node.videoPlayCount,
    comments: (node.latestComments || []).map((c) => ({
      author: c.ownerUsername || 'desconocido',
      text: c.text || '',
    })),
    imageUrl: node.displayUrl,
    videoUrl: node.videoUrl,
    audioTrack: node.musicInfo ? `${node.musicInfo.artist_name || ''} - ${node.musicInfo.song_name || ''}`.trim() : undefined,
    timestamp: node.timestamp,
    type: mapPostType(node),
    url: node.url || '',
  };
}

/** SCRAPER_API_KEY es el nombre preferido; APIFY_TOKEN se acepta por compatibilidad. */
function getScraperToken(): string | undefined {
  return process.env.SCRAPER_API_KEY || process.env.APIFY_TOKEN;
}

async function runApifyProfileActor(username: string): Promise<ApifyProfileItem[]> {
  const token = getScraperToken();
  const actorId = process.env.APIFY_INSTAGRAM_ACTOR_ID || 'apify~instagram-profile-scraper';
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token!)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [username], resultsLimit: 15 }),
  });

  if (!res.ok) {
    throw new Error(`Apify devolvio HTTP ${res.status}: ${await res.text()}`);
  }

  return (await res.json()) as ApifyProfileItem[];
}

export async function scrapeInstagramUrl(rawUrl: string): Promise<ScrapeResult> {
  if (!getScraperToken()) {
    return {
      success: false,
      configured: false,
      error:
        'La extraccion de datos de Instagram no esta configurada en el servidor (falta SCRAPER_API_KEY).',
    };
  }

  const username = extractUsername(rawUrl);

  try {
    const items = await runApifyProfileActor(username);
    const item = items[0];

    if (!item || item.error || !item.username) {
      return { success: false, configured: true, error: `No se encontro el perfil publico @${username}.` };
    }

    const posts = (item.latestPosts || []).map(mapPost);

    if (isSinglePostUrl(rawUrl)) {
      // Buscamos el post especifico dentro de los ultimos disponibles del perfil.
      const shortcodeMatch = rawUrl.match(/\/(?:p|reel|tv)\/([^/?#]+)/i);
      const targetShortcode = shortcodeMatch?.[1];
      const match = targetShortcode ? posts.find((p) => p.shortcode === targetShortcode) : posts[0];

      if (!match) {
        return {
          success: false,
          configured: true,
          error: 'No se pudo encontrar ese post especifico entre las publicaciones recientes del perfil.',
        };
      }

      return {
        success: true,
        isProfile: false,
        username: item.username,
        followers: item.followersCount != null ? String(item.followersCount) : undefined,
        ...match,
      };
    }

    return {
      success: true,
      isProfile: true,
      username: item.username,
      followersCount: item.followersCount,
      followingCount: item.followsCount,
      mediaCount: item.postsCount,
      biography: item.biography,
      profilePicUrl: item.profilePicUrl,
      posts,
    };
  } catch (err) {
    return { success: false, configured: true, error: getErrorMessage(err) || 'Error desconocido al consultar Apify.' };
  }
}

// ================================================================
// MOTOR 1: Analizador de Perfiles Publicos (competidor/propio)
// Contrato de respuesta estandarizado para la tarjeta de "Analizar
// Competidor / Perfil", separado del flujo de importacion al Canvas
// (scrapeInstagramUrl) para no romper los nodos que ya consume ese flujo.
// ================================================================

export interface TopReel {
  id: string;
  url: string;
  caption?: string;
  views?: number;
  likes: number;
  comments: number;
  /** Porcentaje. (likes + comments) / views * 100, o /followers si no hay views. */
  engagement_rate: number;
  type: ScrapedPost['type'];
}

export interface ProfileAnalysis {
  success: true;
  profile: {
    username: string;
    followers: number;
    biography?: string;
    profile_pic?: string;
  };
  top_reels: TopReel[];
  /** Los formatos que mas se repiten entre los posts de mejor desempeño. */
  winning_patterns: string[];
}

export type ProfileAnalysisResult = ProfileAnalysis | ScrapeNotConfigured | ScrapeFailed;

function computeEngagementRate(post: ScrapedPost, followers: number): number {
  const interactions = (post.likes || 0) + (post.commentsCount || 0);
  const base = post.views && post.views > 0 ? post.views : followers;
  if (!base || base <= 0) return 0;
  return Number(((interactions / base) * 100).toFixed(2));
}

const FORMAT_LABELS: Record<ScrapedPost['type'], string> = {
  reel: 'Reels / video corto',
  carousel: 'Carruseles',
  image: 'Imagen unica',
};

/** Detecta los formatos que predominan entre los top posts (no inventa categorias de marketing sin evidencia). */
function detectWinningPatterns(topReels: TopReel[]): string[] {
  const counts = new Map<string, number>();
  for (const reel of topReels) {
    counts.set(reel.type, (counts.get(reel.type) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type, count]) => `${FORMAT_LABELS[type as ScrapedPost['type']]} (${count} de los ${topReels.length} mejores posts)`);
}

/**
 * Motor 1: trae el perfil publico (propio o de un competidor) por @username o
 * URL, ordena sus ultimos posts por engagement rate y devuelve el contrato
 * estandarizado { profile, top_reels, winning_patterns } para la tarjeta de
 * analisis de competidores. No requiere ni pide contrasena del perfil.
 */
export async function analyzeInstagramProfile(usernameOrUrl: string): Promise<ProfileAnalysisResult> {
  if (!getScraperToken()) {
    return {
      success: false,
      configured: false,
      error: 'La extraccion de datos de Instagram no esta configurada en el servidor (falta SCRAPER_API_KEY).',
    };
  }

  const username = extractUsername(usernameOrUrl);

  try {
    const items = await runApifyProfileActor(username);
    const item = items[0];

    if (!item || item.error || !item.username) {
      return { success: false, configured: true, error: `No se encontro el perfil publico @${username}.` };
    }

    const followers = item.followersCount ?? 0;
    const posts = (item.latestPosts || []).map(mapPost);

    const topReels: TopReel[] = posts
      .map((p) => ({
        id: p.shortcode,
        url: p.url,
        caption: p.caption,
        views: p.views,
        likes: p.likes || 0,
        comments: p.commentsCount || 0,
        engagement_rate: computeEngagementRate(p, followers),
        type: p.type,
      }))
      .sort((a, b) => b.engagement_rate - a.engagement_rate)
      .slice(0, 20);

    return {
      success: true,
      profile: {
        username: item.username,
        followers,
        biography: item.biography,
        profile_pic: item.profilePicUrl,
      },
      top_reels: topReels,
      winning_patterns: detectWinningPatterns(topReels.slice(0, 3)),
    };
  } catch (err) {
    return { success: false, configured: true, error: getErrorMessage(err) || 'Error desconocido al consultar Apify.' };
  }
}
