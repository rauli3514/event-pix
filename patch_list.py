import re

with open('src/pages/display-hub/DisplayHubList.tsx', 'r') as f:
    content = f.read()

# Add imports
imports_to_add = """import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { EditScreenModal } from "@/components/display/EditScreenModal";
import { ChevronDown, MoreVertical, Edit2, Info, Move, Trash2, Power } from 'lucide-react';
"""
content = re.sub(
    r"(import { Select.*?;)",
    r"\1\n" + imports_to_add,
    content
)

# Add states
states_to_add = """    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState<any>(null);"""

content = re.sub(
    r"(const \[search, setSearch\].*?\n)",
    r"\1" + states_to_add + "\n",
    content
)

# Replace Grid with List View
start_idx = content.find("{/* Tarjetas de Pantallas */}")
end_idx = content.find("</div>\n    );\n};")

list_view_code = """{/* Lista de Pantallas */}
            <div className="mt-8 space-y-8">
                {Object.entries(
                    filteredLinkedDevices.reduce((acc, device) => {
                        const groupName = device.group?.name || 'Sin Zona Asignada';
                        if (!acc[groupName]) acc[groupName] = [];
                        acc[groupName].push(device);
                        return acc;
                    }, {} as Record<string, typeof filteredLinkedDevices>)
                ).map(([groupName, groupDevices]) => (
                    <div key={groupName} className="space-y-3">
                        <div className="flex items-center gap-2 text-slate-300 font-semibold px-2">
                            <ChevronDown className="w-4 h-4" />
                            {groupName} <span className="text-slate-500 font-normal text-sm ml-1">({groupDevices.length})</span>
                        </div>
                        
                        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/50">
                            {groupDevices.map(device => {
                                const isOnline = device.derived_status === 'online';
                                return (
                                    <div key={device.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 hover:bg-slate-800/30 transition-colors group gap-4 sm:gap-0">
                                        {/* Izquierda: Checkbox, Estado y Nombre */}
                                        <div className="flex items-center gap-4">
                                            <input type="checkbox" className="w-4.5 h-4.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500/20" />
                                            
                                            <div className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 w-[110px] justify-center ${isOnline ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                                                {isOnline && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                                                {isOnline ? 'En línea' : 'Desconectado'}
                                            </div>
                                            
                                            <div>
                                                <h4 className="font-semibold text-slate-200 cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => { setSelectedDevice(device); setEditModalOpen(true); }}>
                                                    {device.name}
                                                </h4>
                                                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                                    Recurso: <span className="text-slate-400">Sin asignar</span>
                                                    <ChevronDown className="w-3 h-3" />
                                                </p>
                                            </div>
                                        </div>

                                        {/* Derecha: Botones de Acción */}
                                        <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity w-full sm:w-auto justify-end">
                                            <Button variant="outline" size="sm" className="h-8 bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800">
                                                <Eye className="w-3.5 h-3.5 mr-1.5" /> Avance
                                            </Button>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="h-8 bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
                                                onClick={() => { setSelectedDevice(device); setEditModalOpen(true); }}
                                            >
                                                <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Editar
                                            </Button>
                                            
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-56 bg-white text-slate-800 border-0 shadow-xl rounded-xl">
                                                    <DropdownMenuItem className="cursor-pointer py-2 focus:bg-slate-100">
                                                        <Info className="w-4 h-4 mr-2 text-slate-500" /> Ver información del dispositivo
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="cursor-pointer py-2 focus:bg-slate-100">
                                                        <Monitor className="w-4 h-4 mr-2 text-slate-500" /> Pantalla de identificación
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator className="bg-slate-100" />
                                                    <DropdownMenuItem className="cursor-pointer py-2 focus:bg-slate-100">
                                                        <Move className="w-4 h-4 mr-2 text-slate-500" /> Mover
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="cursor-pointer py-2 focus:bg-slate-100">
                                                        <Power className="w-4 h-4 mr-2 text-slate-500" /> Trasladar a espera
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator className="bg-slate-100" />
                                                    <DropdownMenuItem className="cursor-pointer py-2 text-rose-600 focus:bg-rose-50 focus:text-rose-700">
                                                        <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
                
                {filteredLinkedDevices.length === 0 && (
                    <div className="py-12 text-center border-2 border-dashed border-slate-800 rounded-2xl">
                        <Monitor className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-white">No se encontraron pantallas</h3>
                        <p className="text-slate-400 text-sm mt-2">Prueba cambiando los filtros o agrega una nueva pantalla.</p>
                    </div>
                )}
            </div>

            <EditScreenModal 
                isOpen={editModalOpen} 
                onClose={() => setEditModalOpen(false)} 
                device={selectedDevice}
                linkGroups={linkGroups || []}
                onSave={(id, updates) => {
                    console.log('Save', id, updates);
                    setEditModalOpen(false);
                    toast.success('Pantalla actualizada');
                }}
            />
"""

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + list_view_code + content[end_idx:]
    with open('src/pages/display-hub/DisplayHubList.tsx', 'w') as f:
        f.write(content)
    print("Replaced content successfully")
else:
    print("Failed to find boundaries")
