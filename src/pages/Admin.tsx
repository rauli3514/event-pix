import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X, Clock } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useSubmissions } from "@/hooks/use-submissions";
import { Submission, SubmissionStatus } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/lib/supabase";

const Admin = () => {
    const { submissions, isLoading, updateStatus } = useSubmissions();

    const handleModeration = (id: string, status: SubmissionStatus) => {
        updateStatus.mutate({ id, status });
    };

    const SubmissionCard = ({ item }: { item: Submission }) => (
        <Card className="overflow-hidden bg-card/50 backdrop-blur border-white/10">
            <div className="p-4">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center text-sm text-muted-foreground">
                        <Clock className="w-4 h-4 mr-1" />
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: es })}
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs ${item.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                        item.status === 'approved' ? 'bg-green-500/20 text-green-500' :
                            'bg-red-500/20 text-red-500'
                        }`}>
                        {item.status.toUpperCase()}
                    </div>
                </div>

                {item.type === 'photo' ? (
                    <div className="aspect-video rounded-md overflow-hidden bg-black/20 mb-4">
                        <img src={item.content} alt="Submission" className="w-full h-full object-cover" />
                    </div>
                ) : (
                    <div className="bg-black/20 p-4 rounded-md mb-4">
                        <p className="text-lg">{item.content}</p>
                        {item.author && <p className="text-sm text-muted-foreground mt-2">- {item.author}</p>}
                    </div>
                )}

                {item.status === 'pending' && (
                    <div className="flex gap-2">
                        <Button
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            onClick={() => handleModeration(item.id, 'approved')}
                        >
                            <Check className="w-4 h-4 mr-2" /> Aprobar
                        </Button>
                        <Button
                            variant="destructive"
                            className="flex-1"
                            onClick={() => handleModeration(item.id, 'rejected')}
                        >
                            <X className="w-4 h-4 mr-2" /> Rechazar
                        </Button>
                    </div>
                )}
            </div>
        </Card>
    );

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center text-white">Cargando...</div>;
    }

    return (
        <div className="min-h-screen bg-background p-6">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-script text-primary">Panel de Moderación</h1>
                <nav className="flex gap-4 items-center">
                    <NavLink to="/">Inicio</NavLink>
                    <NavLink to="/display">Pantalla</NavLink>
                    <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
                        Salir
                    </Button>
                </nav>
            </header>

            <Tabs defaultValue="pending" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-8">
                    <TabsTrigger value="pending">Pendientes ({submissions.filter(s => s.status === 'pending').length})</TabsTrigger>
                    <TabsTrigger value="approved">Aprobados ({submissions.filter(s => s.status === 'approved').length})</TabsTrigger>
                    <TabsTrigger value="rejected">Rechazados ({submissions.filter(s => s.status === 'rejected').length})</TabsTrigger>
                </TabsList>

                {['pending', 'approved', 'rejected'].map((status) => (
                    <TabsContent key={status} value={status}>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {submissions
                                .filter(item => item.status === status)
                                .map(item => (
                                    <SubmissionCard key={item.id} item={item} />
                                ))}
                        </div>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
};

export default Admin;
