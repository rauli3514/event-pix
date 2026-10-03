package com.eventpix.app.print;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.pdf.PdfDocument;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;

import androidx.print.PrintHelper;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Impresión nativa para el kiosco:
 *  - discoverPrinters: busca impresoras IPP en la WiFi (mDNS "_ipp._tcp").
 *  - printImage con `printer`: manda el trabajo directo por IPP, sin diálogo.
 *  - printImage sin `printer`: abre el diálogo de impresión de Android.
 */
@CapacitorPlugin(name = "NativePrint")
public class NativePrintPlugin extends Plugin {

    private static final String SERVICE_TYPE = "_ipp._tcp.";
    private static final int DPI = 300;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    /** Papel soportado: keyword PWG, ancho y alto en centésimas de mm (vertical). */
    private static final class Paper {
        final String keyword;
        final int widthHmm;
        final int heightHmm;

        Paper(String keyword, int widthHmm, int heightHmm) {
            this.keyword = keyword;
            this.widthHmm = widthHmm;
            this.heightHmm = heightHmm;
        }

        int widthPx(int dpi) { return Math.round(widthHmm / 2540f * dpi); }
        int heightPx(int dpi) { return Math.round(heightHmm / 2540f * dpi); }

        /** 10x15 y 13x18 son papel fotográfico; A4 y Carta, papel común. */
        boolean isPhoto() { return keyword.startsWith("na_index-4x6") || keyword.startsWith("na_5x7"); }
        int widthPt() { return Math.round(widthHmm / 2540f * 72); }
        int heightPt() { return Math.round(heightHmm / 2540f * 72); }
    }

    private static Paper paperFor(String id) {
        switch (id == null ? "" : id.toLowerCase(Locale.ROOT)) {
            case "5x7": return new Paper("na_5x7_5x7in", 12700, 17780);
            case "a4": return new Paper("iso_a4_210x297mm", 21000, 29700);
            case "letter": return new Paper("na_letter_8.5x11in", 21590, 27940);
            case "4x6":
            default: return new Paper("na_index-4x6_4x6in", 10160, 15240);
        }
    }

    @Override
    protected void handleOnDestroy() {
        executor.shutdownNow();
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", true);
        call.resolve(ret);
    }

    // ─── Descubrimiento ─────────────────────────────────────────────

    @PluginMethod
    public void discoverPrinters(PluginCall call) {
        int timeoutMs = Math.max(1500, Math.min(call.getInt("timeoutMs", 5000), 20000));
        new PrinterDiscovery(getContext(), timeoutMs, call).start();
    }

    private static final class PrinterDiscovery {
        private final Context context;
        private final int timeoutMs;
        private final PluginCall call;
        private final NsdManager nsd;
        private final Handler main = new Handler(Looper.getMainLooper());
        private final ArrayDeque<NsdServiceInfo> pending = new ArrayDeque<>();
        private final Map<String, JSObject> found = new LinkedHashMap<>();
        private WifiManager.MulticastLock lock;
        private NsdManager.DiscoveryListener listener;
        private boolean resolving;
        private boolean finished;

        PrinterDiscovery(Context context, int timeoutMs, PluginCall call) {
            this.context = context.getApplicationContext();
            this.timeoutMs = timeoutMs;
            this.call = call;
            this.nsd = (NsdManager) this.context.getSystemService(Context.NSD_SERVICE);
        }

        void start() {
            if (nsd == null) {
                call.reject("El dispositivo no soporta búsqueda de impresoras en red");
                return;
            }
            WifiManager wifi = (WifiManager) context.getSystemService(Context.WIFI_SERVICE);
            if (wifi != null) {
                lock = wifi.createMulticastLock("eventpix-print-discovery");
                lock.setReferenceCounted(false);
                lock.acquire();
            }

            listener = new NsdManager.DiscoveryListener() {
                @Override public void onStartDiscoveryFailed(String type, int errorCode) {
                    finish("No se pudo iniciar la búsqueda de impresoras (código " + errorCode + ")");
                }
                @Override public void onStopDiscoveryFailed(String type, int errorCode) {}
                @Override public void onDiscoveryStarted(String type) {}
                @Override public void onDiscoveryStopped(String type) {}
                @Override public void onServiceFound(NsdServiceInfo info) {
                    synchronized (PrinterDiscovery.this) {
                        if (finished) return;
                        pending.add(info);
                        resolveNext();
                    }
                }
                @Override public void onServiceLost(NsdServiceInfo info) {}
            };

            nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener);
            main.postDelayed(() -> finish(null), timeoutMs);
        }

        // Antes de Android 14 NsdManager resuelve un servicio por vez.
        @SuppressWarnings("deprecation")
        private synchronized void resolveNext() {
            if (resolving || finished || pending.isEmpty()) return;
            resolving = true;
            NsdServiceInfo next = pending.poll();
            nsd.resolveService(next, new NsdManager.ResolveListener() {
                @Override public void onResolveFailed(NsdServiceInfo info, int errorCode) {
                    synchronized (PrinterDiscovery.this) {
                        resolving = false;
                        resolveNext();
                    }
                }
                @Override public void onServiceResolved(NsdServiceInfo info) {
                    synchronized (PrinterDiscovery.this) {
                        resolving = false;
                        addPrinter(info);
                        resolveNext();
                    }
                }
            });
        }

        @SuppressWarnings("deprecation")
        private void addPrinter(NsdServiceInfo info) {
            InetAddress host = info.getHost();
            if (host == null) return;
            Map<String, byte[]> txt = info.getAttributes();
            String model = txtValue(txt, "ty");
            JSObject printer = new JSObject();
            printer.put("serviceName", info.getServiceName());
            printer.put("name", model.isEmpty() ? info.getServiceName() : model);
            printer.put("host", host.getHostAddress());
            printer.put("port", info.getPort());
            printer.put("rp", txtValue(txt, "rp"));
            printer.put("pdl", txtValue(txt, "pdl"));
            found.put(info.getServiceName(), printer);
        }

        private static String txtValue(Map<String, byte[]> txt, String key) {
            byte[] v = txt == null ? null : txt.get(key);
            return v == null ? "" : new String(v, StandardCharsets.UTF_8);
        }

        private synchronized void finish(String error) {
            if (finished) return;
            finished = true;
            try {
                nsd.stopServiceDiscovery(listener);
            } catch (IllegalArgumentException ignored) {
                // La búsqueda nunca llegó a arrancar
            }
            if (lock != null && lock.isHeld()) lock.release();

            if (error != null && found.isEmpty()) {
                call.reject(error);
                return;
            }
            JSArray printers = new JSArray();
            for (JSObject p : found.values()) printers.put(p);
            JSObject ret = new JSObject();
            ret.put("printers", printers);
            call.resolve(ret);
        }
    }

    // ─── Impresión ──────────────────────────────────────────────────

    @PluginMethod
    public void printImage(PluginCall call) {
        String image = call.getString("image");
        if (image == null || image.isEmpty()) {
            call.reject("Falta la imagen a imprimir");
            return;
        }
        JSObject printer = call.getObject("printer");
        Paper paper = paperFor(call.getString("paper", "4x6"));
        String orientation = call.getString("orientation", "portrait");
        int rotation = call.getInt("rotation", 0);
        String scaleMode = call.getString("scaleMode", "cover");
        int copies = Math.max(1, call.getInt("copies", 1));
        boolean borderless = Boolean.TRUE.equals(call.getBoolean("borderless", false));
        String jobName = call.getString("jobName", "EventPix");

        executor.execute(() -> {
            Bitmap page = null;
            try {
                Bitmap source = loadBitmap(image);
                int totalRotation = rotation + ("landscape".equals(orientation) ? 90 : 0);

                if (printer != null && printer.has("host")) {
                    Capabilities caps = capabilitiesFor(printer, paper);
                    page = composePage(source, paper, totalRotation, scaleMode, caps.dpi);
                    source.recycle();
                    printSilently(call, printer, page, paper, caps, copies, borderless, jobName);
                    page.recycle();
                } else {
                    page = composePage(source, paper, totalRotation, scaleMode, DPI);
                    source.recycle();
                    printWithDialog(call, page, jobName);
                }
            } catch (Exception e) {
                if (page != null) page.recycle();
                call.reject(e.getMessage() != null ? e.getMessage() : e.toString(), e);
            }
        });
    }

    /** Formato y parámetros con los que se le va a mandar el trabajo a la impresora. */
    private static final class Capabilities {
        String format;
        int dpi = DPI;
        boolean color = true;
        String mediaType;
    }

    private static Capabilities capabilitiesFor(JSObject printer, Paper paper) throws IOException {
        String pdl = printer.getString("pdl", "").toLowerCase(Locale.ROOT);
        Capabilities caps = new Capabilities();
        if (pdl.isEmpty() || pdl.contains("image/jpeg")) {
            caps.format = "image/jpeg";
        } else if (pdl.contains("application/pdf")) {
            caps.format = "application/pdf";
        } else if (pdl.contains("image/pwg-raster")) {
            caps.format = "image/pwg-raster";
        } else {
            throw new IOException("La impresora no acepta JPEG, PDF ni PWG raster (formatos: " + pdl + ")");
        }

        // Para PWG raster hay que usar una resolución y un tipo de color que la impresora acepte
        String host = printer.getString("host");
        int port = printer.getInteger("port", 631);
        String rp = printer.getString("rp", "ipp/print");
        IppClient.Result attrs;
        try {
            attrs = IppClient.getPrinterAttributes(host, port, rp,
                    "pwg-raster-document-resolution-supported",
                    "pwg-raster-document-type-supported",
                    "media-type-supported");
        } catch (IOException e) {
            if (caps.format.equals("image/pwg-raster")) {
                throw new IOException("No se pudo consultar la impresora: " + e.getMessage(), e);
            }
            return caps; // JPEG/PDF funcionan sin estos datos
        }

        if (caps.format.equals("image/pwg-raster")) {
            caps.dpi = IppClient.pickResolution(attrs.get("pwg-raster-document-resolution-supported"), DPI);
            boolean srgb = false;
            boolean gray = false;
            for (IppClient.Value v : attrs.get("pwg-raster-document-type-supported")) {
                srgb |= v.asString().equals("srgb_8");
                gray |= v.asString().equals("sgray_8");
            }
            if (!srgb && gray) caps.color = false;
            else if (!srgb) throw new IOException("La impresora no acepta PWG raster sRGB de 8 bits");
        }

        if (paper.isPhoto()) caps.mediaType = IppClient.pickPhotoMediaType(attrs.get("media-type-supported"));
        return caps;
    }

    private void printSilently(PluginCall call, JSObject printer, Bitmap page, Paper paper, Capabilities caps,
                               int copies, boolean borderless, String jobName) throws IOException {
        String host = printer.getString("host");
        int port = printer.getInteger("port", 631);
        String rp = printer.getString("rp", "ipp/print");

        String format = caps.format;
        byte[] document;
        if (format.equals("image/jpeg")) {
            document = toJpeg(page);
        } else if (format.equals("application/pdf")) {
            document = toPdf(page, paper);
        } else {
            document = toPwgRaster(page, paper, caps);
        }

        IppClient.Options options = new IppClient.Options();
        options.jobName = jobName;
        options.copies = copies;
        options.mediaKeyword = paper.keyword;
        options.mediaWidthHmm = paper.widthHmm;
        options.mediaHeightHmm = paper.heightHmm;
        options.mediaType = caps.mediaType;
        options.borderless = borderless;
        // En raster la página ya viene al tamaño exacto; print-scaling es para JPEG/PDF
        options.printScaling = format.equals("image/pwg-raster") ? null : "fill";

        IppClient.Result result = IppClient.printJob(host, port, rp, format, document, options);
        if (!result.isSuccess()) {
            String msg = result.statusMessage != null ? result.statusMessage
                    : String.format(Locale.ROOT, "código IPP 0x%04x", result.statusCode);
            throw new IOException("La impresora rechazó el trabajo: " + msg);
        }
        JSObject ret = new JSObject();
        ret.put("mode", "silent");
        ret.put("jobId", result.jobId);
        ret.put("format", format);
        call.resolve(ret);
    }

    private void printWithDialog(PluginCall call, Bitmap page, String jobName) {
        getActivity().runOnUiThread(() -> {
            try {
                PrintHelper helper = new PrintHelper(getActivity());
                // La página ya viene armada al tamaño del papel
                helper.setScaleMode(PrintHelper.SCALE_MODE_FIT);
                helper.setColorMode(PrintHelper.COLOR_MODE_COLOR);
                helper.setOrientation(PrintHelper.ORIENTATION_PORTRAIT);
                helper.printBitmap(jobName, page, page::recycle);
                JSObject ret = new JSObject();
                ret.put("mode", "dialog");
                call.resolve(ret);
            } catch (Exception e) {
                page.recycle();
                call.reject("No se pudo abrir el diálogo de impresión: " + e.getMessage(), e);
            }
        });
    }

    // ─── Imagen ─────────────────────────────────────────────────────

    private static Bitmap loadBitmap(String image) throws IOException {
        byte[] bytes;
        if (image.startsWith("data:")) {
            int comma = image.indexOf(',');
            if (comma < 0) throw new IOException("Data URL inválida");
            bytes = Base64.decode(image.substring(comma + 1), Base64.DEFAULT);
        } else if (image.startsWith("http://") || image.startsWith("https://")) {
            bytes = download(image);
        } else {
            bytes = Base64.decode(image, Base64.DEFAULT);
        }
        Bitmap bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        if (bmp == null) throw new IOException("No se pudo leer la imagen");
        return bmp;
    }

    private static byte[] download(String url) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) URI.create(url).toURL().openConnection();
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(30000);
        try {
            int code = conn.getResponseCode();
            if (code != 200) throw new IOException("No se pudo descargar la imagen (HTTP " + code + ")");
            try (InputStream in = conn.getInputStream()) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
                return out.toByteArray();
            }
        } finally {
            conn.disconnect();
        }
    }

    /** Arma la página completa (vertical, 300 dpi) con fondo blanco. */
    private static Bitmap composePage(Bitmap source, Paper paper, int rotation, String scaleMode, int dpi) {
        int pageW = paper.widthPx(dpi);
        int pageH = paper.heightPx(dpi);
        Bitmap page = Bitmap.createBitmap(pageW, pageH, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(page);
        canvas.drawColor(Color.WHITE);

        int rot = ((rotation % 360) + 360) % 360;
        boolean swapped = rot == 90 || rot == 270;
        float srcW = swapped ? source.getHeight() : source.getWidth();
        float srcH = swapped ? source.getWidth() : source.getHeight();

        float sx = pageW / srcW;
        float sy = pageH / srcH;
        if ("contain".equals(scaleMode)) {
            sx = sy = Math.min(sx, sy);
        } else if (!"fill".equals(scaleMode)) { // cover
            sx = sy = Math.max(sx, sy);
        }

        Matrix m = new Matrix();
        m.postTranslate(-source.getWidth() / 2f, -source.getHeight() / 2f);
        m.postRotate(rot);
        m.postScale(sx, sy);
        m.postTranslate(pageW / 2f, pageH / 2f);
        canvas.drawBitmap(source, m, new Paint(Paint.FILTER_BITMAP_FLAG | Paint.ANTI_ALIAS_FLAG));
        return page;
    }

    private static byte[] toPwgRaster(Bitmap page, Paper paper, Capabilities caps) throws IOException {
        PwgRaster.Page p = new PwgRaster.Page();
        p.widthPx = page.getWidth();
        p.heightPx = page.getHeight();
        p.dpi = caps.dpi;
        p.color = caps.color;
        p.pageSizeName = paper.keyword;
        p.mediaType = caps.mediaType != null ? caps.mediaType : "";
        return PwgRaster.encode(p, (y, out) -> page.getPixels(out, 0, p.widthPx, 0, y, p.widthPx, 1));
    }

    private static byte[] toJpeg(Bitmap page) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        page.compress(Bitmap.CompressFormat.JPEG, 95, out);
        return out.toByteArray();
    }

    private static byte[] toPdf(Bitmap page, Paper paper) throws IOException {
        PdfDocument pdf = new PdfDocument();
        try {
            PdfDocument.PageInfo info = new PdfDocument.PageInfo.Builder(paper.widthPt(), paper.heightPt(), 1).create();
            PdfDocument.Page pdfPage = pdf.startPage(info);
            pdfPage.getCanvas().drawBitmap(page, null,
                    new RectF(0, 0, paper.widthPt(), paper.heightPt()), new Paint(Paint.FILTER_BITMAP_FLAG));
            pdf.finishPage(pdfPage);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            pdf.writeTo(out);
            return out.toByteArray();
        } finally {
            pdf.close();
        }
    }
}
