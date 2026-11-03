import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
    // Cada cuánto vuelve a intentar después de un error.
    retryMs?: number;
    onError?: (error: Error) => void;
}

interface State {
    failedAt: number | null;
}

// Si lo de adentro falla (por ejemplo, un servicio externo respondió algo
// raro), muestra negro y lo vuelve a intentar solo, en vez de dejar la
// pantalla apagada hasta reiniciar la TV.
export class RetryBoundary extends Component<Props, State> {
    state: State = { failedAt: null };
    private timer: ReturnType<typeof setTimeout> | null = null;

    static getDerivedStateFromError(): State {
        return { failedAt: Date.now() };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('Contenido con error, se reintenta:', error, info.componentStack);
        this.props.onError?.(error);
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => this.setState({ failedAt: null }), this.props.retryMs ?? 30_000);
    }

    componentWillUnmount() {
        if (this.timer) clearTimeout(this.timer);
    }

    render() {
        if (this.state.failedAt !== null) return <div className="w-full h-full bg-black" />;
        return this.props.children;
    }
}
