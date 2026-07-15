// Local AI Settings helper
export const getLocalAISettings = () => {
    try {
        const stored = localStorage.getItem('eventpix_ai_settings');
        return stored ? JSON.parse(stored) : { enabled: false, level: 'medium' };
    } catch {
        return { enabled: false, level: 'medium' };
    }
};

export const saveLocalAISettings = (enabled: boolean, level: string) => {
    localStorage.setItem('eventpix_ai_settings', JSON.stringify({ enabled, level }));
};
