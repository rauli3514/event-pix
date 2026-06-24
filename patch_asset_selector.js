const fs = require('fs');
let code = fs.readFileSync('src/components/display/AssetSelectorModal.tsx', 'utf8');

// 1. Add imports
code = code.replace(
  "import { useDisplayMedia } from '@/hooks/use-display-media';",
  "import { useDisplayMedia } from '@/hooks/use-display-media';\nimport { useDisplayCampaigns } from '@/hooks/use-display-hub';"
);

// 2. Add activeTab state
code = code.replace(
  "const [search, setSearch] = useState('');",
  "const [search, setSearch] = useState('');\n    const [activeTab, setActiveTab] = useState<'archivos' | 'listas'>('archivos');"
);

// 3. Fetch campaigns
code = code.replace(
  "const { data: mediaFiles = [], isLoading } = useDisplayMedia(commerceId);",
  "const { data: mediaFiles = [], isLoading: isLoadingMedia } = useDisplayMedia(commerceId);\n    const { data: campaigns = [], isLoading: isLoadingCampaigns } = useDisplayCampaigns(commerceId);\n    const isLoading = activeTab === 'archivos' ? isLoadingMedia : isLoadingCampaigns;"
);

// 4. Update filteredAssets
code = code.replace(
  "const filteredAssets = useMemo(() => {\n        return mediaFiles.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));\n    }, [mediaFiles, search]);",
  "const filteredAssets = useMemo(() => {\n        if (activeTab === 'archivos') {\n            return mediaFiles.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));\n        } else {\n            return campaigns.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).map(c => ({\n                ...c,\n                type: 'campaign',\n                url: null,\n                size_bytes: 0\n            }));\n        }\n    }, [mediaFiles, campaigns, search, activeTab]);"
);

// 5. Update tabs UI
code = code.replace(
  '<Button variant="ghost" size="sm" className="h-8 bg-white shadow-sm px-4">Archivos</Button>\n                                <Button variant="ghost" size="sm" className="h-8 px-4 text-slate-500 hover:text-slate-700">Engage</Button>',
  `<Button variant="ghost" size="sm" className={\`h-8 px-4 \${activeTab === 'archivos' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}\`} onClick={() => { setActiveTab('archivos'); setSelectedAsset(null); }}>Archivos</Button>
                                <Button variant="ghost" size="sm" className={\`h-8 px-4 \${activeTab === 'listas' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}\`} onClick={() => { setActiveTab('listas'); setSelectedAsset(null); }}>Listas de Reproducción</Button>`
);

// 6. Update grid area title
code = code.replace(
  "Archivos / Recursos ({filteredAssets.length})",
  "{activeTab === 'archivos' ? 'Archivos / Recursos' : 'Listas de Reproducción'} ({filteredAssets.length})"
);

fs.writeFileSync('src/components/display/AssetSelectorModal.tsx', code);
