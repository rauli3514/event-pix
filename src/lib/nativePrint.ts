import { Capacitor, registerPlugin } from '@capacitor/core';

// Impresora IPP encontrada en la WiFi (ver NativePrintPlugin.java)
export interface NativePrinter {
  serviceName: string;
  name: string;
  host: string;
  port: number;
  /** Ruta del recurso IPP, p. ej. "ipp/print" */
  rp: string;
  /** Formatos que acepta, p. ej. "image/jpeg,application/pdf" */
  pdl: string;
}

export type PaperSize = '4x6' | '5x7' | 'a4' | 'letter';

export interface NativePrintOptions {
  /** Data URL, base64 o URL http(s) de la imagen */
  image: string;
  /** Si viene, imprime directo por IPP sin diálogo; si no, abre el diálogo de Android */
  printer?: NativePrinter | null;
  paper?: PaperSize;
  orientation?: 'portrait' | 'landscape';
  rotation?: number;
  scaleMode?: 'cover' | 'contain' | 'fill';
  copies?: number;
  borderless?: boolean;
  jobName?: string;
}

export interface NativePrintResult {
  mode: 'silent' | 'dialog';
  jobId?: number;
  format?: string;
}

interface NativePrintPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  discoverPrinters(options?: { timeoutMs?: number }): Promise<{ printers: NativePrinter[] }>;
  printImage(options: NativePrintOptions): Promise<NativePrintResult>;
}

const NativePrint = registerPlugin<NativePrintPlugin>('NativePrint');

export const PAPER_SIZES: { value: PaperSize; label: string }[] = [
  { value: '4x6', label: '10×15 cm (4×6")' },
  { value: '5x7', label: '13×18 cm (5×7")' },
  { value: 'a4', label: 'A4' },
  { value: 'letter', label: 'Carta' },
];

export const isNativePrintAvailable = () =>
  Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('NativePrint');

/** Igual que NativePrintPlugin: sin "pdl" se asume JPEG; si no, hace falta JPEG o PDF. */
export const isPrintableDirect = (printer: NativePrinter) => {
  const pdl = printer.pdl.toLowerCase();
  return !pdl || pdl.includes('image/jpeg') || pdl.includes('application/pdf');
};

export const discoverNativePrinters = async (timeoutMs = 5000) =>
  (await NativePrint.discoverPrinters({ timeoutMs })).printers;

// El lado nativo no puede leer URLs del WebView (relativas o https://localhost),
// así que se le pasa la imagen ya leída. Si el fetch falla (p. ej. CORS), se le
// pasa la URL para que la descargue él.
const toDataUrl = async (image: string) => {
  if (image.startsWith('data:')) return image;
  try {
    const blob = await (await fetch(image)).blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return new URL(image, window.location.href).href;
  }
};

export const printImageNative = async (options: NativePrintOptions) =>
  NativePrint.printImage({ ...options, image: await toDataUrl(options.image) });

export const printErrorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));
