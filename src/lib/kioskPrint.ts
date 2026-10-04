import { toast } from 'sonner';
import { isNativePrintAvailable, printImageNative, printErrorMessage } from '@/lib/nativePrint';
import { toPortraitForPrint } from '@/lib/photoLayout';

// Imprime una foto del kiosco con la configuración de Ajustes → Impresora
// (en la app: directo a la impresora o diálogo de Android; en la web: servidor
// local o diálogo del navegador). La usan el resultado y la galería.

export const printKioskPhoto = async (photo: string) => {
  // El papel 10×15 entra vertical: una hoja horizontal se gira antes de imprimir
  const imageUrl = await toPortraitForPrint(photo).catch(() => photo);
  const cfg = (() => {
    try { return JSON.parse(localStorage.getItem('kiosk_print_settings') || '{}'); }
    catch { return {}; }
  })();

  // 0. APP ANDROID: impresión nativa (directa por WiFi o diálogo del sistema)
  if (isNativePrintAvailable()) {
    const options = {
      image: imageUrl,
      paper: cfg.paper || '4x6',
      orientation: 'portrait' as const, // la hoja ya llega vertical (toPortraitForPrint)
      rotation: cfg.rotation || 0,
      scaleMode: cfg.imageAdjust || 'cover',
      copies: cfg.copies || 1,
      borderless: !!cfg.borderless,
      bleed: Number(cfg.bleed) || 0,
      format: cfg.printFormat || 'auto',
      jobName: 'EventPix',
    };
    try {
      const res = await printImageNative({ ...options, printer: cfg.nativePrinter || null });
      if (res.mode === 'silent') toast.success("Impresión enviada correctamente");
    } catch (err) {
      // Con impresora elegida no se abre el diálogo de Android: en la TV box no hay
      // servicios de impresión y solo aparece "Todas las impresoras" vacío
      toast.error(`No se pudo imprimir: ${printErrorMessage(err)}. Probá "Imprimir de nuevo".`);
    }
    return;
  }

  // 1. INTENTAR IMPRESIÓN SILENCIOSA (Local Server)
  if (cfg.selectedPrinter && cfg.selectedPrinter !== 'Impresora del Sistema (diálogo del navegador)') {
    try {
      const res = await fetch('http://localhost:3001/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: imageUrl,
          printerName: cfg.selectedPrinter,
          copies: cfg.copies || 1
        })
      });
      
      if (res.ok) {
        toast.success("Impresión enviada correctamente");
        return; // Éxito, no necesitamos abrir el diálogo del navegador
      }
    } catch {
      console.warn("Servidor de impresión local no disponible, usando diálogo del navegador.");
    }
  }

  // 2. FALLBACK: DIÁLOGO DEL NAVEGADOR (Si el servidor no está o falla)
  const pw = window.open('', '_blank', 'width=800,height=600');
  if (!pw) {
    toast.error("Por favor, permite las ventanas emergentes para imprimir");
    return;
  }


  const rotation = cfg.rotation || 0;
  const orientation = 'portrait';

  pw.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Imprimir Foto - Kiosco</title>
        <style>
          @page {
            size: 4in 6in ${orientation};
            margin: 0;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: 4in;
            height: 6in;
            background: white;
            overflow: hidden;
          }
          .print-container {
            width: 4in;
            height: 6in;
            display: flex;
            align-items: center;
            justify-content: center;
            ${rotation !== 0 ? `transform: rotate(${rotation}deg); transform-origin: center;` : ''}
          }
          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            image-rendering: -webkit-optimize-contrast;
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          <img src="${imageUrl}" onload="setTimeout(() => { window.print(); window.close(); }, 500)"/>
        </div>
      </body>
    </html>
  `);
  pw.document.close();
};
