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
import android.Manifest;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;

import androidx.print.PrintHelper;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PermissionState;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Impresión nativa para el kiosco:
 *  - discoverPrinters: busca impresoras IPP en la WiFi (mDNS "_ipp._tcp").
 *  - printImage con `printer`: manda el trabajo directo por IPP, sin diálogo.
 *  - printImage sin `printer`: abre el diálogo de impresión de Android.
 *  - connectWifiDirect: prueba la conexión con la red DIRECT-... de la impresora,
 *    para imprimir sin router (ver WifiDirectLink).
 */
@CapacitorPlugin(
        name = "NativePrint",
        permissions = {
                // Wi-Fi Direct: Android 10-12 pide ubicación; Android 13+ "dispositivos Wi-Fi cercanos"
                @Permission(alias = "location", strings = {Manifest.permission.ACCESS_FINE_LOCATION}),
                @Permission(alias = "nearbyWifi", strings = {Manifest.permission.NEARBY_WIFI_DEVICES})
        }
)
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

    // ─── USB ────────────────────────────────────────────────────────

    /** Impresoras conectadas por cable (y si se pueden usar: IPP por USB). */
    @PluginMethod
    public void findUsbPrinters(PluginCall call) {
        JSArray list = new JSArray();
        for (android.hardware.usb.UsbDevice d : UsbPrinterLink.printers(getContext())) list.put(UsbPrinterLink.describe(d));
        JSObject ret = new JSObject();
        ret.put("printers", list);
        call.resolve(ret);
    }

    /** Consulta la impresora USB (pide permiso si hace falta) y devuelve qué acepta. */
    @PluginMethod
    public void testUsbPrinter(PluginCall call) {
        String usb = call.getString("usb", "");
        executor.execute(() -> {
            Target target = new Target();
            try {
                target.usb = UsbPrinterLink.open(getContext(), usb);
                IppClient.Result attrs = IppClient.getPrinterAttributes(target.transport(), target.uri(), target.rp,
                        "printer-make-and-model", "document-format-supported", "printer-state");
                JSObject ret = new JSObject();
                ret.put("name", target.usb.name);
                StringBuilder formats = new StringBuilder();
                for (IppClient.Value v : attrs.get("document-format-supported")) formats.append(v.asString()).append(' ');
                ret.put("formats", formats.toString().trim());
                java.util.List<IppClient.Value> model = attrs.get("printer-make-and-model");
                if (!model.isEmpty()) ret.put("model", model.get(0).asString());
                call.resolve(ret);
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : e.toString(), e);
            } finally {
                if (target.usb != null) target.usb.close();
            }
        });
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
        // Agranda la imagen unos % para tapar la franja blanca que dejan algunas impresoras sin bordes
        // (solo sin bordes: con bordes la foto entra entera, sin recortar nada)
        float bleed = borderless ? Math.max(0f, Math.min(8f, call.getFloat("bleed", 0f))) / 100f : 0f;
        String preferredFormat = call.getString("format", "auto");
        // Papel: auto (fotográfico en 10x15 y 13x18), glossy, matte o plain (común)
        String paperType = call.getString("paperType", "auto");
        String jobName = call.getString("jobName", "EventPix");

        executor.execute(() -> {
            Bitmap page = null;
            WifiDirectLink.Session session = null;
            try {
                Bitmap source = loadBitmap(image);
                int totalRotation = rotation + ("landscape".equals(orientation) ? 90 : 0);

                if (printer != null && printer.has("usb")) {
                    // Por cable USB (IPP por USB)
                    Target target = new Target();
                    target.name = printer.getString("name", "");
                    target.usb = UsbPrinterLink.open(getContext(), printer.getString("usb"));
                    try {
                        Capabilities caps = capabilitiesFor(target, paper, preferredFormat, borderless, paperType);
                        page = composePage(source, paper, totalRotation, scaleMode, caps.dpi, bleed, borderless);
                        source.recycle();
                        printSilently(call, target, page, paper, caps, copies, borderless, jobName);
                        page.recycle();
                    } finally {
                        target.usb.close();
                    }
                } else if (printer != null && (printer.has("host") || printer.has("wifiDirect"))) {
                    session = openWifiDirect(printer);
                    Target target = targetFor(printer, session);
                    Capabilities caps = capabilitiesFor(target, paper, preferredFormat, borderless, paperType);
                    page = composePage(source, paper, totalRotation, scaleMode, caps.dpi, bleed, borderless);
                    source.recycle();
                    printSilently(call, target, page, paper, caps, copies, borderless, jobName);
                    page.recycle();
                } else {
                    page = composePage(source, paper, totalRotation, scaleMode, DPI, bleed, borderless);
                    source.recycle();
                    printWithDialog(call, page, jobName);
                }
            } catch (Exception e) {
                if (page != null) page.recycle();
                call.reject(e.getMessage() != null ? e.getMessage() : e.toString(), e);
            } finally {
                if (session != null) session.close();
            }
        });
    }

    // ─── Wi-Fi Direct ───────────────────────────────────────────────

    /**
     * Prueba la conexión Wi-Fi Direct con la impresora y devuelve cómo quedó:
     * modo (p2p/temporary), impresora encontrada, formatos y si sigue habiendo internet.
     */
    @PluginMethod
    public void connectWifiDirect(PluginCall call) {
        if (!hasWifiDirectPermission()) {
            requestPermissionForAlias(wifiDirectPermissionAlias(), call, "wifiDirectPermissionCallback");
            return;
        }
        String ssid = call.getString("ssid", "");
        String passphrase = call.getString("passphrase", "");
        String mode = call.getString("mode");
        if (ssid.isEmpty() || passphrase.length() < 8) {
            call.reject("Falta el nombre de la red DIRECT-... o la clave (mínimo 8 caracteres)");
            return;
        }
        executor.execute(() -> {
            JSObject printer = new JSObject();
            JSObject wifiDirect = new JSObject();
            wifiDirect.put("ssid", ssid);
            wifiDirect.put("passphrase", passphrase);
            if (mode != null) wifiDirect.put("mode", mode);
            printer.put("wifiDirect", wifiDirect);

            try (WifiDirectLink.Session session = openWifiDirect(printer)) {
                Target target = targetFor(printer, session);
                IppClient.Result attrs = IppClient.getPrinterAttributes(target.sockets, target.host, target.port,
                        target.rp, "printer-make-and-model", "document-format-supported");
                StringBuilder formats = new StringBuilder();
                for (IppClient.Value v : attrs.get("document-format-supported")) {
                    if (formats.length() > 0) formats.append(',');
                    formats.append(v.asString());
                }
                java.util.List<IppClient.Value> model = attrs.get("printer-make-and-model");

                JSObject ret = new JSObject();
                ret.put("mode", session.mode);
                ret.put("host", target.host);
                ret.put("port", target.port);
                ret.put("rp", target.rp);
                ret.put("pdl", formats.toString());
                ret.put("name", model.isEmpty() ? target.name : model.get(0).asString());
                ret.put("internet", wifiDirectLink().hasInternet());
                call.resolve(ret);
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : e.toString(), e);
            }
        });
    }

    @PermissionCallback
    private void wifiDirectPermissionCallback(PluginCall call) {
        if (hasWifiDirectPermission()) {
            connectWifiDirect(call);
        } else {
            call.reject("Sin permiso para usar Wi-Fi Direct");
        }
    }

    private String wifiDirectPermissionAlias() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? "nearbyWifi" : "location";
    }

    private boolean hasWifiDirectPermission() {
        return getPermissionState(wifiDirectPermissionAlias()) == PermissionState.GRANTED;
    }

    private WifiDirectLink wifiDirectLink;

    private synchronized WifiDirectLink wifiDirectLink() {
        if (wifiDirectLink == null) wifiDirectLink = new WifiDirectLink(getContext());
        return wifiDirectLink;
    }

    /** Si la impresora se usa por Wi-Fi Direct abre la conexión; si no, devuelve null. */
    private WifiDirectLink.Session openWifiDirect(JSObject printer) throws IOException {
        JSObject wd = jsObject(printer, "wifiDirect");
        if (wd == null) return null;
        String mode = wd.getString("mode");
        // Sin permiso solo se puede usar la conexión temporal
        if (!hasWifiDirectPermission()) mode = WifiDirectLink.MODE_TEMPORARY;
        return wifiDirectLink().open(wd.getString("ssid", ""), wd.getString("passphrase", ""), mode);
    }

    private static JSObject jsObject(JSObject parent, String key) {
        try {
            org.json.JSONObject o = parent.optJSONObject(key);
            return o == null ? null : JSObject.fromJSONObject(o);
        } catch (org.json.JSONException e) {
            return null;
        }
    }

    // ─── Destino y capacidades ──────────────────────────────────────

    /** Dónde y por qué red mandar el trabajo. */
    private static final class Target {
        String name = "";
        String host;
        int port = 631;
        String rp = "ipp/print";
        String pdl = "";
        javax.net.SocketFactory sockets;
        /** Por cable USB (IPP por USB); si no, por la red */
        UsbPrinterLink usb;

        IppClient.Transport transport() {
            return usb != null ? usb : IppClient.network(sockets, host, port);
        }

        String uri() {
            return usb != null ? UsbPrinterLink.printerUri(rp) : IppClient.printerUri(host, port, rp);
        }
    }

    private static Target targetFor(JSObject printer, WifiDirectLink.Session session) throws IOException {
        Target t = new Target();
        t.name = printer.getString("name", "");
        t.host = printer.getString("host");
        t.port = printer.getInteger("port", 631);
        t.rp = printer.getString("rp", "ipp/print");
        t.pdl = printer.getString("pdl", "");
        if (session == null) {
            if (t.host == null || t.host.isEmpty()) throw new IOException("Falta la dirección de la impresora");
            return t;
        }

        t.sockets = session.sockets;
        t.host = session.host;
        // En P2P la IP la da el grupo (el dueño del grupo es la impresora). En modo temporal
        // se busca por mDNS atado a esa red; nunca por la red por defecto, que podría
        // devolver otra impresora del salón.
        if (session.network == null) return t;
        try {
            java.util.List<MdnsLookup.Printer> found = MdnsLookup.findIppPrinters(session.network::bindSocket, 2500);
            if (!found.isEmpty()) {
                MdnsLookup.Printer p = found.get(0);
                t.name = p.name;
                t.host = p.host;
                t.port = p.port;
                t.rp = p.rp;
                if (!p.pdl.isEmpty()) t.pdl = p.pdl;
            }
        } catch (IOException ignored) {
            // Sin respuesta mDNS: se usa la IP de la impresora según la conexión
        }
        return t;
    }

    /** Formato y parámetros con los que se le va a mandar el trabajo a la impresora. */
    private static final class Capabilities {
        String format;
        int dpi = DPI;
        boolean color = true;
        String mediaType;
        /** Máxima resolución que anuncia (valor crudo IPP), foto optimizada y color forzado */
        byte[] printResolution;
        boolean photoOptimize;
        boolean forceColor;
        /** Formatos que acepta (para reintentar con otro si rechaza el elegido) */
        String supported = "";
        /** null = no se sabe; false = la impresora no anuncia márgenes en 0 */
        Boolean borderlessSupported;
    }

    private static Capabilities capabilitiesFor(Target target, Paper paper, String preferred, boolean borderless,
                                                String paperType) throws IOException {
        IppClient.Result attrs = null;
        IOException queryError = null;
        try {
            attrs = IppClient.getPrinterAttributes(target.transport(), target.uri(), target.rp,
                    "document-format-supported",
                    "pwg-raster-document-resolution-supported",
                    "pwg-raster-document-type-supported",
                    "media-type-supported",
                    "printer-resolution-supported",
                    "print-content-optimize-supported",
                    "print-color-mode-supported",
                    "media-left-margin-supported", "media-right-margin-supported",
                    "media-top-margin-supported", "media-bottom-margin-supported");
        } catch (IOException e) {
            queryError = e;
        }

        String pdl = target.pdl.toLowerCase(Locale.ROOT);
        if (attrs != null) {
            StringBuilder sb = new StringBuilder();
            for (IppClient.Value v : attrs.get("document-format-supported")) sb.append(v.asString()).append(',');
            if (sb.length() > 0) pdl = sb.toString().toLowerCase(Locale.ROOT);
        }

        Capabilities caps = new Capabilities();
        caps.supported = pdl;
        boolean pwgOk = pdl.contains("image/pwg-raster") && attrs != null;
        if ("pwg".equals(preferred) && pwgOk) {
            caps.format = "image/pwg-raster";
        } else if ("jpeg".equals(preferred) && pdl.contains("image/jpeg")) {
            caps.format = "image/jpeg";
        } else if ("auto".equals(preferred) && borderless && pwgOk) {
            // Sin bordes: el raster va al tamaño exacto del papel y la impresora no lo
            // achica ni lo corre (con JPEG algunas Epson dejan una franja blanca)
            caps.format = "image/pwg-raster";
        } else if (pdl.isEmpty() || pdl.contains("image/jpeg")) {
            caps.format = "image/jpeg";
        } else if (pdl.contains("application/pdf")) {
            caps.format = "application/pdf";
        } else if (pdl.contains("image/pwg-raster")) {
            caps.format = "image/pwg-raster";
        } else {
            throw new IOException("La impresora no acepta JPEG, PDF ni PWG raster (formatos: " + pdl + ")");
        }

        if (attrs == null) {
            // Para PWG raster hay que saber la resolución y el color que acepta
            if (caps.format.equals("image/pwg-raster")) {
                throw new IOException("No se pudo consultar la impresora: " + queryError.getMessage(), queryError);
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
            if (!srgb && !"pwg".equals(preferred) && pdl.contains("image/jpeg")) { // mejor JPEG en color
                caps.format = "image/jpeg";
                caps.dpi = DPI;
            }
            else if (!srgb && gray) caps.color = false;
            else if (!srgb) throw new IOException("La impresora no acepta PWG raster sRGB de 8 bits");
        }

        boolean photoPaper = "glossy".equals(paperType) || "matte".equals(paperType)
                || (!"plain".equals(paperType) && paper.isPhoto());
        if (photoPaper) caps.mediaType = IppClient.pickPhotoMediaType(attrs.get("media-type-supported"), paperType);
        else if ("plain".equals(paperType) && IppClient.hasKeyword(attrs.get("media-type-supported"), "stationery")) {
            caps.mediaType = "stationery";
        }
        // Calidad de foto: la resolución más alta (en raster la da la página misma),
        // contenido "foto" y color
        if (!caps.format.equals("image/pwg-raster")) {
            caps.printResolution = IppClient.pickBestResolution(attrs.get("printer-resolution-supported"));
        }
        caps.photoOptimize = IppClient.hasKeyword(attrs.get("print-content-optimize-supported"), "photo");
        caps.forceColor = caps.color && IppClient.hasKeyword(attrs.get("print-color-mode-supported"), "color");
        boolean zero = true;
        boolean any = false;
        for (String side : new String[]{"left", "right", "top", "bottom"}) {
            List<IppClient.Value> values = attrs.get("media-" + side + "-margin-supported");
            if (values.isEmpty()) continue;
            any = true;
            boolean has0 = false;
            for (IppClient.Value v : values) has0 |= v.asInt() == 0;
            zero &= has0;
        }
        if (any) caps.borderlessSupported = zero;
        return caps;
    }

    private void printSilently(PluginCall call, Target target, Bitmap page, Paper paper, Capabilities caps,
                               int copies, boolean borderless, String jobName) throws IOException {
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
        // Sin bordes: llena el papel. Con bordes: "fit", la impresora la achica a su zona
        // imprimible en vez de recortar el logo o el marco
        String scaling = borderless ? "fill" : "fit";
        options.printScaling = format.equals("image/pwg-raster") ? null : scaling;
        options.printResolution = caps.printResolution;
        options.contentOptimize = caps.photoOptimize ? "photo" : null;
        options.colorMode = caps.forceColor ? "color" : null;

        IppClient.Result result = IppClient.printJob(target.transport(), target.uri(), target.rp,
                format, document, options);
        boolean extras = options.printResolution != null || options.contentOptimize != null || options.colorMode != null;
        if (!result.isSuccess() && extras) {
            // Alguna impresora rechaza la combinación: se reintenta con sus valores de fábrica
            options.printResolution = null;
            options.contentOptimize = null;
            options.colorMode = null;
            result = IppClient.printJob(target.transport(), target.uri(), target.rp, format, document, options);
        }
        if (!result.isSuccess() && format.equals("image/pwg-raster") && caps.supported.contains("image/jpeg")) {
            // Rechazó el raster: se reintenta en JPEG
            format = "image/jpeg";
            options.printScaling = scaling;
            result = IppClient.printJob(target.transport(), target.uri(), target.rp, format, toJpeg(page), options);
        }
        if (!result.isSuccess()) {
            String msg = result.statusMessage != null ? result.statusMessage
                    : String.format(Locale.ROOT, "código IPP 0x%04x", result.statusCode);
            throw new IOException("La impresora rechazó el trabajo: " + msg);
        }
        JSObject ret = new JSObject();
        ret.put("mode", "silent");
        ret.put("jobId", result.jobId);
        ret.put("format", format);
        ret.put("dpi", caps.dpi);
        if (caps.mediaType != null) ret.put("mediaType", caps.mediaType);
        String resolution = IppClient.resolutionLabel(options.printResolution);
        if (resolution != null) ret.put("resolution", resolution);
        if (caps.borderlessSupported != null) ret.put("borderlessSupported", caps.borderlessSupported);
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
    /** Margen blanco con bordes: un poco más que el de las impresoras (3 mm), así no se corta nada. */
    private static final float SAFE_MARGIN_MM = 4f;

    private static Bitmap composePage(Bitmap source, Paper paper, int rotation, String scaleMode, int dpi, float bleed,
                                      boolean borderless) {
        int pageW = paper.widthPx(dpi);
        int pageH = paper.heightPx(dpi);
        Bitmap page = Bitmap.createBitmap(pageW, pageH, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(page);
        canvas.drawColor(Color.WHITE);

        int rot = ((rotation % 360) + 360) % 360;
        boolean swapped = rot == 90 || rot == 270;
        float srcW = swapped ? source.getHeight() : source.getWidth();
        float srcH = swapped ? source.getWidth() : source.getHeight();

        // Con bordes la foto entra entera dentro del margen (nunca se recorta)
        float margin = borderless ? 0f : SAFE_MARGIN_MM / 25.4f * dpi;
        float sx = (pageW - 2 * margin) / srcW;
        float sy = (pageH - 2 * margin) / srcH;
        if (!borderless || "contain".equals(scaleMode)) {
            sx = sy = Math.min(sx, sy);
        } else if (!"fill".equals(scaleMode)) { // cover
            sx = sy = Math.max(sx, sy);
        }

        sx *= 1f + bleed;
        sy *= 1f + bleed;

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
