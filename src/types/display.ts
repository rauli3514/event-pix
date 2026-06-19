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
    pairing_status: 'pending' | 'linked';
    last_seen: string | null;
    created_at: string;
    updated_at: string;
}

export interface DisplayGroup {
    id: string;
    commerce_id: string;
    name: string;
    description: string | null;
    created_at: string;
}

export type CampaignItemType = 'external_url' | 'event_photos' | 'event_ranking' | 'image_ad' | 'event_trivia';

export interface CampaignItem {
    id: string;
    type: CampaignItemType;
    duration: number; // in seconds
    // Properties depending on type
    url?: string;
    eventId?: string;
    imageUrl?: string;
    title?: string;
}

export interface DisplayCampaign {
    id: string;
    commerce_id: string;
    name: string;
    description: string | null;
    items_json: CampaignItem[];
    created_at: string;
}

export interface DisplayAssignment {
    id: string;
    device_id: string | null;
    group_id: string | null;
    campaign_id: string | null;
    created_at: string;
    campaign?: DisplayCampaign;
}

export interface DisplayHeartbeat {
    id: string;
    device_id: string;
    created_at: string;
    app_version: string | null;
    ip: string | null;
    metadata: any;
}

// Interfaz para la respuesta de configuración del APK
export interface DisplayConfigResponse {
    deviceCode: string;
    template: string;
    widgets: {
        type: string;
        url?: string;
    }[];
}
