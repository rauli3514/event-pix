import { useState } from "react";
import { useParams } from "react-router-dom";
import { FaWhatsapp } from "react-icons/fa";
import { DemoComposer } from "@/components/demo/DemoComposer";
import { useDemoSender } from "@/hooks/use-demo-channel";
import { isValidDemoSession, salesWhatsAppUrl } from "@/lib/demoWall";

/** Celular en la demo: lo que abre el QR de la pantalla de demo */
const DemoUpload = () => {
    const { session } = useParams();
    const valid = isValidDemoSession(session);
    const send = useDemoSender(valid ? session! : null);
    const [sent, setSent] = useState(0);

    return (
        <div className="min-h-[100dvh] bg-gradient-to-b from-slate-950 via-violet-950/40 to-slate-950 px-5 py-8 text-white">
            <div className="mx-auto max-w-md space-y-6">
                <div className="text-center">
                    <span className="rounded-full bg-fuchsia-600 px-3 py-1 text-xs font-extrabold tracking-widest">DEMO EVENTPIX</span>
                    <h1 className="mt-4 text-3xl font-extrabold leading-tight">
                        {sent === 0 ? 'Subí tu foto a la pantalla' : '¡Mirá la pantalla! 👀'}
                    </h1>
                    <p className="mt-2 text-white/70">
                        {sent === 0
                            ? 'Así lo viven tus invitados: sin apps, en segundos.'
                            : 'Así aparece cada foto en tu fiesta. ¿Mandás otra?'}
                    </p>
                </div>

                {valid ? (
                    <DemoComposer onSend={async (post) => { await send(post); setSent((n) => n + 1); }} />
                ) : (
                    <p className="rounded-2xl bg-white/5 p-5 text-center text-white/80">
                        Este código de demo no es válido. Volvé a escanear el QR de la pantalla.
                    </p>
                )}

                {sent > 0 && (
                    <a
                        href={salesWhatsAppUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-green-600 text-lg font-bold hover:bg-green-500"
                    >
                        <FaWhatsapp className="h-5 w-5" /> ¿Lo querés en tu evento? Consultá tu fecha
                    </a>
                )}

                <p className="text-center text-xs text-white/50">
                    Es una demo privada: tu foto solo aparece en esa pantalla y no se guarda.
                </p>
            </div>
        </div>
    );
};

export default DemoUpload;
