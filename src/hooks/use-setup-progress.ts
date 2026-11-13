import { useDisplayDevices } from '@/hooks/use-display-hub';
import { useDisplayMedia } from '@/hooks/use-display-media';
import { usePriceLists } from '@/hooks/use-price-lists';
import { isPosterItem } from '@/lib/posters';

// Pasos de la guía para empezar, y cuáles ya hizo el negocio (se marcan solos).
export type SetupStepId = 'screen' | 'link' | 'poster' | 'prices' | 'send';

export const SETUP_STEPS: SetupStepId[] = ['screen', 'link', 'poster', 'prices', 'send'];

export function useSetupProgress(commerceId?: string) {
    const { data: devices = [], isLoading: l1 } = useDisplayDevices(commerceId);
    const { data: media = [], isLoading: l2 } = useDisplayMedia(commerceId);
    const { data: priceLists, isLoading: l3 } = usePriceLists(commerceId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const linked = (devices as any[]).filter(d => d.derived_status !== 'pending');
    const posters = media.filter(isPosterItem).length;
    const lists = priceLists?.lists.length || 0;
    const sent = linked.some(d => !!d.assignment);

    const done: Record<SetupStepId, boolean> = {
        screen: linked.length > 0,
        link: linked.length > 0,
        poster: posters > 0,
        prices: lists > 0,
        send: sent,
    };
    const count = SETUP_STEPS.filter(s => done[s]).length;
    return { done, count, total: SETUP_STEPS.length, complete: count === SETUP_STEPS.length, loading: l1 || l2 || l3 };
}
