import { AIAction } from '@/services/AIAgentService';
import { Button } from '@/components/ui/button';
import { Check, X, Sparkles } from 'lucide-react';
import { useState } from 'react';

interface AIActionCardProps {
    action: AIAction;
    onExecute: (action: AIAction) => Promise<void>;
    onCancel: (action: AIAction) => void;
}

export function AIActionCard({ action, onExecute, onCancel }: AIActionCardProps) {
    const [status, setStatus] = useState<'pending' | 'executing' | 'done' | 'cancelled'>('pending');

    const handleExecute = async () => {
        setStatus('executing');
        await onExecute(action);
        setStatus('done');
    };

    const handleCancel = () => {
        setStatus('cancelled');
        onCancel(action);
    };

    if (status === 'done' || status === 'cancelled') {
        return null;
    }

    return (
        <div className="bg-white border border-indigo-100 rounded-xl p-4 my-2 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
                <div className="bg-indigo-100 p-1.5 rounded-md text-indigo-600">
                    <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="font-semibold text-slate-800 text-sm">Acción Propuesta</h4>
            </div>
            
            <p className="text-sm text-slate-600 mb-4 bg-slate-50 p-2 rounded-md border border-slate-100">
                {action.description}
            </p>

            <div className="flex items-center gap-2">
                <Button 
                    size="sm" 
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={handleExecute}
                    disabled={status === 'executing'}
                >
                    {status === 'executing' ? 'Ejecutando...' : (
                        <>
                            <Check className="w-4 h-4 mr-1.5" /> Confirmar
                        </>
                    )}
                </Button>
                <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1 border-slate-200 hover:bg-slate-50"
                    onClick={handleCancel}
                    disabled={status === 'executing'}
                >
                    <X className="w-4 h-4 mr-1.5" /> Cancelar
                </Button>
            </div>
        </div>
    );
}
