import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ChevronDown, ChevronUp, MapPin, MonitorPlay } from 'lucide-react';
import { DisplayDeviceWithStatus } from '@/hooks/use-display-hub';

interface EditScreenModalProps {
    isOpen: boolean;
    onClose: () => void;
    device: DisplayDeviceWithStatus | null;
    linkGroups: any[];
    onSave: (deviceId: string, updates: any) => void;
}

export const EditScreenModal = ({ isOpen, onClose, device, linkGroups, onSave }: EditScreenModalProps) => {
    const [name, setName] = useState('');
    const [groupId, setGroupId] = useState('none');
    const [showAdvanced, setShowAdvanced] = useState(false);
    
    // UI Mock States (Pro features)
    const [contentType, setContentType] = useState('asset');
    const [scale, setScale] = useState('fit');
    const [orientation, setOrientation] = useState('landscape');
    const [location, setLocation] = useState('');
    const [showDownloading, setShowDownloading] = useState(true);
    const [preloadAssets, setPreloadAssets] = useState(true);

    useEffect(() => {
        if (device) {
            setName(device.name || '');
            setGroupId(device.group_id || 'none');
            // reset UI mocks
            setShowAdvanced(false);
        }
    }, [device]);

    const handleSave = () => {
        if (!device) return;
        onSave(device.id, {
            name,
            group_id: groupId === 'none' ? null : groupId,
            // future pro fields can be packed into metadata here
        });
    };

    if (!device) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-white text-slate-900 border-0 shadow-2xl max-w-2xl p-0 overflow-hidden sm:rounded-2xl">
                <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex flex-row items-center justify-between">
                    <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                        <MonitorPlay className="w-5 h-5 text-slate-500" />
                        Edit Screen "{device.name}"
                    </DialogTitle>
                </DialogHeader>

                <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
                    {/* General Section */}
                    <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-500 font-medium">Device Name <span className="text-rose-500">*</span></Label>
                        <Input 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                            className="border-emerald-500 focus-visible:ring-emerald-500 shadow-sm"
                        />
                    </div>

                    <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-500 font-medium">Tags (Zona)</Label>
                        <Select value={groupId} onValueChange={setGroupId}>
                            <SelectTrigger className="w-full shadow-sm bg-white">
                                <SelectValue placeholder="Add a tag / zone" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Sin Zona (None)</SelectItem>
                                {linkGroups?.map(g => (
                                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-500 font-medium">Content Type <span className="text-rose-500">*</span></Label>
                        <Select value={contentType} onValueChange={setContentType}>
                            <SelectTrigger className="w-full shadow-sm bg-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="asset">Asset (Playlist / Imagen)</SelectItem>
                                <SelectItem value="url">URL Web</SelectItem>
                                <SelectItem value="dashboard">Dashboard Interactivo</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-500 font-medium">Selected Asset <span className="text-rose-500">*</span></Label>
                        <div className="flex gap-2">
                            <Input value="Promo Verano 2026" readOnly className="shadow-sm bg-slate-50 text-slate-600" />
                            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white shrink-0 shadow-sm">
                                Change
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-500 font-medium">Scale</Label>
                        <Select value={scale} onValueChange={setScale}>
                            <SelectTrigger className="w-full shadow-sm bg-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="fit">Fit (Ajustar)</SelectItem>
                                <SelectItem value="fill">Fill (Rellenar)</SelectItem>
                                <SelectItem value="stretch">Stretch (Estirar)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-500 font-medium">Orientation</Label>
                        <Select value={orientation} onValueChange={setOrientation}>
                            <SelectTrigger className="w-full shadow-sm bg-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="landscape">Landscape (Horizontal)</SelectItem>
                                <SelectItem value="portrait">Portrait (Vertical)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Operational Schedule Section */}
                    <div className="mt-8 border border-slate-200 rounded-xl overflow-hidden">
                        <button className="w-full px-4 py-3 bg-slate-50 flex items-center gap-2 hover:bg-slate-100 transition-colors">
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                            <span className="font-semibold text-slate-700">Operational Schedule</span>
                            <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center ml-1">
                                <span className="text-[10px] text-slate-400">i</span>
                            </div>
                        </button>
                    </div>

                    {/* Advanced Section */}
                    <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
                        <button 
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="w-full px-4 py-3 bg-slate-50 flex items-center gap-2 hover:bg-slate-100 transition-colors border-b border-slate-100"
                        >
                            {showAdvanced ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                            <span className="font-semibold text-slate-700">Advanced</span>
                        </button>
                        
                        {showAdvanced && (
                            <div className="p-6 space-y-6 bg-white">
                                <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                    <Label className="text-right text-slate-500 font-medium">Functional Location</Label>
                                    <div className="flex gap-2">
                                        <Input defaultValue="Main Location" className="shadow-sm" />
                                        <Button variant="outline" className="shrink-0 bg-white shadow-sm border-slate-200">Change</Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                    <Label className="text-right text-slate-500 font-medium">Location</Label>
                                    <div className="relative">
                                        <MapPin className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                                        <Input 
                                            placeholder="e.g. Houston, TX" 
                                            value={location}
                                            onChange={(e) => setLocation(e.target.value)}
                                            className="pl-9 shadow-sm"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                    <Label className="text-right text-slate-500 font-medium">Background Type</Label>
                                    <Select defaultValue="default">
                                        <SelectTrigger className="shadow-sm bg-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="default">Default</SelectItem>
                                            <SelectItem value="color">Solid Color</SelectItem>
                                            <SelectItem value="image">Custom Image</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-[140px_1fr] items-center gap-4 pt-4 border-t border-slate-100">
                                    <Label className="text-right text-slate-500 font-medium leading-tight">Show Downloading Status</Label>
                                    <Switch 
                                        checked={showDownloading} 
                                        onCheckedChange={setShowDownloading} 
                                        className="data-[state=checked]:bg-emerald-500"
                                    />
                                </div>

                                <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                    <Label className="text-right text-slate-500 font-medium leading-tight">Preload Assets in Playlist</Label>
                                    <Switch 
                                        checked={preloadAssets} 
                                        onCheckedChange={setPreloadAssets} 
                                        className="data-[state=checked]:bg-emerald-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex sm:justify-between items-center w-full">
                    <div className="flex items-center text-slate-400 cursor-help hover:text-slate-600">
                        <div className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center font-bold text-xs mr-2">
                            ?
                        </div>
                        <Button variant="ghost" size="sm" className="px-0 hover:bg-transparent">Preview</Button>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={onClose} className="text-slate-600 hover:bg-slate-200">
                            Close
                        </Button>
                        <Button variant="outline" className="border-slate-200 shadow-sm text-slate-600 hover:bg-slate-100">
                            Schedule
                        </Button>
                        <div className="flex rounded-md shadow-sm">
                            <Button onClick={handleSave} className="bg-emerald-400 hover:bg-emerald-500 text-white rounded-r-none px-6 shadow-sm border-r border-emerald-500/20">
                                Save
                            </Button>
                            <Button className="bg-emerald-400 hover:bg-emerald-500 text-white rounded-l-none px-2 shadow-sm border-l border-emerald-300">
                                <ChevronDown className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
