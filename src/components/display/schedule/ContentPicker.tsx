import { useState } from 'react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AssetSelectorModal } from '@/components/display/AssetSelectorModal';
import { useDisplayCampaigns } from '@/hooks/use-display-hub';

export interface PickedContent {
    kind: 'campaign' | 'media';
    id: string;
    name: string;
    type?: string;
}

interface Props {
    commerceId: string;
    value: PickedContent | null;
    onChange: (value: PickedContent | null) => void;
    // Para "lo de siempre": se puede dejar sin nada (pantalla negra).
    noneLabel?: string;
    placeholder?: string;
    className?: string;
}

const OTHER = '__other';
const NONE = '__none';

// Qué se muestra: una playlist (lo más común) o cualquier archivo de Medios.
export function ContentPicker({ commerceId, value, onChange, noneLabel, placeholder = 'Elegí una playlist', className = '' }: Props) {
    const { data: playlists = [] } = useDisplayCampaigns(commerceId);
    const [assetOpen, setAssetOpen] = useState(false);

    const current = value ? `${value.kind === 'campaign' ? 'c' : 'm'}:${value.id}` : (noneLabel ? NONE : '');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = playlists as any[];
    const currentIsListed = !value || value.kind === 'media' || list.some(p => p.id === value.id);

    const handleChange = (v: string) => {
        if (v === OTHER) { setAssetOpen(true); return; }
        if (v === NONE) { onChange(null); return; }
        const [prefix, id] = v.split(':');
        if (prefix === 'c') {
            const p = list.find(x => x.id === id);
            if (p) onChange({ kind: 'campaign', id, name: p.name });
        }
    };

    return (
        <>
            <Select value={current} onValueChange={handleChange}>
                <SelectTrigger className={`bg-background border-border ${className}`}>
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground max-h-80">
                    {noneLabel && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
                    <SelectGroup>
                        <SelectLabel>Playlists</SelectLabel>
                        {list.map(p => <SelectItem key={p.id} value={`c:${p.id}`}>{p.name}</SelectItem>)}
                        {!currentIsListed && value && <SelectItem value={current}>{value.name}</SelectItem>}
                        {list.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Todavía no hay playlists</div>}
                    </SelectGroup>
                    {value?.kind === 'media' && (
                        <SelectGroup>
                            <SelectLabel>Archivo</SelectLabel>
                            <SelectItem value={current}>{value.name}</SelectItem>
                        </SelectGroup>
                    )}
                    <SelectSeparator />
                    <SelectItem value={OTHER}>Elegir un archivo de Medios…</SelectItem>
                </SelectContent>
            </Select>
            <AssetSelectorModal
                isOpen={assetOpen}
                onClose={() => setAssetOpen(false)}
                onSelect={asset => {
                    setAssetOpen(false);
                    if (!asset) return;
                    if (asset.type === 'schedule') {
                        toast.error('Una programación no puede ir dentro de otra');
                        return;
                    }
                    onChange(asset.type === 'campaign'
                        ? { kind: 'campaign', id: asset.id, name: asset.name }
                        : { kind: 'media', id: asset.id, name: asset.name, type: asset.type });
                }}
            />
        </>
    );
}
