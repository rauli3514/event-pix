
export interface DisplayMedia {
    id: string;
    commerce_id: string;
    name: string;
    type: string;
    url: string;
    storage_path: string;
    size_bytes: number;
    folder_path: string;
    metadata?: any;
    created_at: string;
}

export interface DisplayDevice {

    id: string;
    device_id: string;
    commerce_id: string | null;
    group_id: string | null;
    name: string | null;
    description: string | null;
    device_model: string | null;
    app_version: string | null;
    android_version: string | null;
    scale: string;
    orientation: string;
    pairing_status: 'pending' | 'linked';
    settings: any | null; // For Setup Screens (timezone, cache, reload commands)
    last_seen: string | null;
    created_at: string;
    updated_at: string;
}

export interface DisplayGroup {
    id: string;
    commerce_id: string;
    parent_id: string | null;
    name: string;
    description: string | null;
    created_at: string;
}

// ---------------------------------------------------------
// V1 Legacy Types (Mantener para retrocompatibilidad interna)
// ---------------------------------------------------------
export type CampaignItemType = 'external_url' | 'event_photos' | 'event_ranking' | 'image_ad' | 'event_trivia';

export interface CampaignItem {
    id: string;
    type: CampaignItemType;
    duration: number; // in seconds
    url?: string;
    eventId?: string;
    imageUrl?: string;
    title?: string;
}

// ---------------------------------------------------------
// V2 Universal Architecture Types
// ---------------------------------------------------------

export type DisplayOrientation = 'landscape' | 'portrait' | 'auto';
export type DisplayBackgroundType = 'color' | 'image' | 'video';
export type DisplayFitMode = 'contain' | 'cover' | 'fill' | 'none';
export type DisplayTransition = 'none' | 'fade' | 'slide' | 'zoom';
export type ElementAlignmentH = 'left' | 'center' | 'right';
export type ElementAlignmentV = 'top' | 'center' | 'bottom';

export type UniversalElementType = 
    | 'image' | 'video' | 'url' | 'pdf' | 'text' | 'qr' 
    | 'clock' | 'weather' | 'rss' | 'news' | 'social' 
    | 'queue' | 'dashboard' | 'eventpix' | 'giveaway'
    | 'app' | 'widget' | 'layout';

export interface ElementMargin {
    top: number;
    bottom: number;
    left: number;
    right: number;
}

export interface ElementAlignment {
    horizontal: ElementAlignmentH;
    vertical: ElementAlignmentV;
}

export interface UniversalElement {
    id: string;
    type: UniversalElementType;
    url?: string;
    content?: string;          // Para textos
    duration: number;          // Segundos (0 = auto)
    transition?: DisplayTransition;
    fitMode?: DisplayFitMode;
    alignment?: ElementAlignment;
    margin?: ElementMargin;
    metadata?: any;            // Para configuración de Apps y Widgets
    
    // Configuraciones específicas
    mute?: boolean;            // Para video
    volume?: number;           // Para video
    loop?: boolean;            // Para video
    font?: string;             // Para texto
    fontSize?: number;         // Para texto
    color?: string;            // Para texto
    backgroundColor?: string;  // Para texto
    scrollSpeed?: number;      // Para texto (0 = fijo)
}

export interface DisplayZone {
    id: string;
    name: string;
    width: string | number;
    height: string | number;
    top: string | number;
    left: string | number;
    zIndex: number;
    playlist: UniversalElement[];
}

export interface DisplaySettings {
    orientation: DisplayOrientation;
    background: {
        type: DisplayBackgroundType;
        value: string;
    };
    shuffle?: boolean;
    transition?: DisplayTransition;
    defaultDuration?: number;
}

export interface DisplayCampaignV2 {
    version: '2.0';
    settings: DisplaySettings;
    zones: DisplayZone[];
}

// El campo items_json en la BD puede contener V1 (Array) o V2 (Objeto JSON)
export type CampaignDataPayload = CampaignItem[] | DisplayCampaignV2;

// ---------------------------------------------------------

export interface DisplayCampaign {
    id: string;
    commerce_id: string;
    name: string;
    description: string | null;
    folder_path: string;
    items_json: CampaignDataPayload;
    created_at: string;
}

export interface DisplayAssignment {
    id: string;
    device_id: string | null;
    group_id: string | null;
    campaign_id: string | null;
    media_id: string | null;
    start_time: string | null;
    end_time: string | null;
    created_at: string;
    
    // Relations
    campaign?: DisplayCampaign;
    media?: DisplayMedia;
}

export interface DisplayHeartbeat {
    id: string;
    device_id: string;
    created_at: string;
    app_version: string | null;
    ip: string | null;
    metadata: any;
}

export interface DynamicLabel {
    id: string;
    name?: string; // Optional name to identify the label
    text: string;
    x: number; // percentage 0-100
    y: number; // percentage 0-100
    color: string;
    fontFamily: string;
    fontSize: number; // in vw or similar relative unit, or just generic size multiplier 1-10
    fontWeight: string;
    fontStyle: string; // normal, italic
    animation: string;
}
