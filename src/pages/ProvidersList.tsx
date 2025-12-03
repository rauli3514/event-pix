import { useState } from 'react';
import { useProviders, useCreateProvider, useIsSuperAdmin } from '@/hooks/use-roles';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from 'sonner';
import { Link, Navigate } from 'react-router-dom';
import { UserPlus, Users, ArrowLeft, Mail, Calendar, Shield } from 'lucide-react';

const ProvidersList = () => {
    const isSuperAdmin = useIsSuperAdmin();
    const { data: providers, isLoading } = useProviders();
    const createProvider = useCreateProvider();

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newProvider, setNewProvider] = useState({
        email: '',
        name: '',
        password: ''
    });

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createProvider.mutate(newProvider, {
            onSuccess: () => {
                setIsCreateOpen(false);
                setNewProvider({ email: '', name: '', password: '' });
                toast.success('Provider creado exitosamente');
            },
            onError: (error: any) => {
                toast.error(error.message || 'Error al crear provider');
            }
        });
    };

    // Protección de ruta: Solo Super Admin
    if (!isSuperAdmin && !isLoading) {
        return <Navigate to="/admin" />;
    }

    if (isLoading) return <div className="min-h-screen flex items-center justify-center">Cargando usuarios...</div>;

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <header className="max-w-5xl mx-auto flex justify-between items-center mb-12">
                <div className="flex items-center gap-4">
                    <Link to="/admin" className="text-slate-500 hover:text-slate-900 transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Gestión de Usuarios</h1>
                        <p className="text-slate-500">Administra los providers del sistema</p>
                    </div>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-violet-600 hover:bg-violet-700">
                            <UserPlus className="w-4 h-4 mr-2" /> Nuevo Provider
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Crear Nuevo Provider</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCreateSubmit} className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={newProvider.email}
                                    onChange={(e) => setNewProvider({ ...newProvider, email: e.target.value })}
                                    placeholder="usuario@ejemplo.com"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="name">Nombre (Opcional)</Label>
                                <Input
                                    id="name"
                                    value={newProvider.name}
                                    onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                                    placeholder="Juan Pérez"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Contraseña</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={newProvider.password}
                                    onChange={(e) => setNewProvider({ ...newProvider, password: e.target.value })}
                                    placeholder="Mínimo 6 caracteres"
                                    required
                                    minLength={6}
                                />
                            </div>
                            <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700" disabled={createProvider.isPending}>
                                {createProvider.isPending ? 'Creando...' : 'Crear Provider'}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </header>

            <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {providers?.map(provider => (
                    <Card key={provider.id} className="hover:shadow-lg transition-shadow border-slate-200">
                        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-lg font-bold text-slate-800 truncate pr-2">
                                {provider.name || 'Sin nombre'}
                            </CardTitle>
                            <Shield className="w-4 h-4 text-violet-500" />
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center text-sm text-slate-600">
                                <Mail className="w-4 h-4 mr-2 text-slate-400" />
                                <span className="truncate">{provider.email}</span>
                            </div>
                            <div className="flex items-center text-sm text-slate-500">
                                <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                                <span>Registrado: {new Date(provider.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="pt-2">
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                                    Provider
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {providers?.length === 0 && (
                    <div className="col-span-full text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">No hay providers registrados</h3>
                        <p className="text-slate-500 mt-2">Crea el primer usuario para comenzar a delegar eventos.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProvidersList;
