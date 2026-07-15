import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "./ui/button";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center bg-slate-950">
                    <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-4 text-3xl">
                        ⚠️
                    </div>
                    <h2 className="text-2xl font-bold text-red-500 mb-4">Ups, algo salió mal</h2>
                    <p className="text-slate-400 mb-6 max-w-md">
                        {this.state.error?.message || "Ha ocurrido un error inesperado al cargar esta vista del administrador."}
                    </p>
                    <Button onClick={() => window.location.reload()} variant="outline" className="border-red-500/50 text-red-500 hover:bg-red-500/10">
                        Recargar la página
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
