package com.eventpix.app.print;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import java.io.BufferedInputStream;
import java.io.Closeable;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Impresora por cable USB (con hub en la TV box). Dos formas:
 * - "IPP por USB" (clase 7, subclase 1, protocolo 4): el mismo IPP que por WiFi,
 *   pero por el cable (PWG raster, sin bordes, papel fotográfico).
 * - Cable "común" (protocolo 1 o 2): se le manda el idioma propio de la impresora.
 *   Las Epson (p. ej. la L1250, que no tiene IPP por USB) entienden ESC/P-R, ver
 *   EscprEncoder.
 */
final class UsbPrinterLink implements Closeable, IppClient.Transport {

    private static final String ACTION_PERMISSION = "com.eventpix.app.USB_PRINTER_PERMISSION";
    private static final int USB_CLASS_PRINTER = 7;
    private static final int PROTOCOL_IPP_USB = 4;
    private static final int PROTOCOL_UNIDIRECTIONAL = 1;
    private static final int PROTOCOL_BIDIRECTIONAL = 2;
    static final int VENDOR_EPSON = 0x04B8;
    /** Cuánto se espera a que la impresora acepte más datos (calienta, limpia cabezales…) */
    private static final int RAW_STALL_MS = 180000;
    private static final int TIMEOUT_MS = 30000;
    private static final int CHUNK = 16384;

    private final UsbDeviceConnection connection;
    private final UsbInterface iface;
    private final UsbEndpoint in;
    private final UsbEndpoint out;
    final String name;

    /** true = cable común (sin IPP): se le manda el idioma de la impresora */
    final boolean raw;
    final int vendorId;

    private UsbPrinterLink(UsbDeviceConnection connection, UsbInterface iface, UsbEndpoint in, UsbEndpoint out,
                           String name, boolean raw, int vendorId) {
        this.connection = connection;
        this.iface = iface;
        this.in = in;
        this.out = out;
        this.name = name;
        this.raw = raw;
        this.vendorId = vendorId;
    }

    // ─── Búsqueda ───────────────────────────────────────────────────

    static List<UsbDevice> printers(Context context) {
        UsbManager manager = (UsbManager) context.getSystemService(Context.USB_SERVICE);
        List<UsbDevice> result = new ArrayList<>();
        if (manager == null) return result;
        for (UsbDevice d : manager.getDeviceList().values()) {
            for (int i = 0; i < d.getInterfaceCount(); i++) {
                if (d.getInterface(i).getInterfaceClass() == USB_CLASS_PRINTER) {
                    result.add(d);
                    break;
                }
            }
        }
        return result;
    }

    static boolean hasIppUsb(UsbDevice d) {
        return ippInterface(d) != null;
    }

    private static UsbInterface ippInterface(UsbDevice d) {
        for (int i = 0; i < d.getInterfaceCount(); i++) {
            UsbInterface it = d.getInterface(i);
            if (it.getInterfaceClass() == USB_CLASS_PRINTER && it.getInterfaceProtocol() == PROTOCOL_IPP_USB) return it;
        }
        return null;
    }

    /** Interfaz de impresora común (bidireccional si hay; si no, la de solo ida). */
    private static UsbInterface rawInterface(UsbDevice d) {
        UsbInterface uni = null;
        for (int i = 0; i < d.getInterfaceCount(); i++) {
            UsbInterface it = d.getInterface(i);
            if (it.getInterfaceClass() != USB_CLASS_PRINTER) continue;
            if (it.getInterfaceProtocol() == PROTOCOL_BIDIRECTIONAL) return it;
            if (it.getInterfaceProtocol() == PROTOCOL_UNIDIRECTIONAL && uni == null) uni = it;
        }
        return uni;
    }

    /** Se puede imprimir por cable: IPP por USB, o una Epson con cable común (ESC/P-R). */
    static boolean printable(UsbDevice d) {
        return hasIppUsb(d) || (d.getVendorId() == VENDOR_EPSON && rawInterface(d) != null);
    }

    static String displayName(UsbDevice d) {
        String manufacturer = null;
        String product = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            manufacturer = d.getManufacturerName();
            product = d.getProductName();
        }
        String n = ((manufacturer != null ? manufacturer + " " : "") + (product != null ? product : "")).trim();
        return n.isEmpty() ? String.format("Impresora USB %04x:%04x", d.getVendorId(), d.getProductId()) : n;
    }

    /** Datos de la impresora para elegirla en Ajustes (y para diagnosticar). */
    static JSObject describe(UsbDevice d) {
        JSObject o = new JSObject();
        o.put("usb", d.getDeviceName());
        o.put("name", displayName(d));
        o.put("vendorId", d.getVendorId());
        o.put("productId", d.getProductId());
        o.put("ippUsb", hasIppUsb(d));
        o.put("escpr", !hasIppUsb(d) && d.getVendorId() == VENDOR_EPSON && rawInterface(d) != null);
        JSArray protocols = new JSArray();
        for (int i = 0; i < d.getInterfaceCount(); i++) {
            UsbInterface it = d.getInterface(i);
            if (it.getInterfaceClass() == USB_CLASS_PRINTER) protocols.put(it.getInterfaceProtocol());
        }
        o.put("protocols", protocols);
        return o;
    }

    // ─── Permiso ────────────────────────────────────────────────────

    /** Pide permiso para usar la impresora (Android muestra un cartel la primera vez). */
    static boolean ensurePermission(Context context, UsbDevice device) throws IOException {
        UsbManager manager = (UsbManager) context.getSystemService(Context.USB_SERVICE);
        if (manager == null) throw new IOException("Este equipo no tiene USB host");
        if (manager.hasPermission(device)) return true;

        CountDownLatch latch = new CountDownLatch(1);
        boolean[] granted = {false};
        BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context c, Intent intent) {
                granted[0] = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
                latch.countDown();
            }
        };
        IntentFilter filter = new IntentFilter(ACTION_PERMISSION);
        if (Build.VERSION.SDK_INT >= 33) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            context.registerReceiver(receiver, filter);
        }
        try {
            int flags = Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0;
            Intent intent = new Intent(ACTION_PERMISSION).setPackage(context.getPackageName());
            manager.requestPermission(device, PendingIntent.getBroadcast(context, 0, intent, flags));
            if (!latch.await(60, TimeUnit.SECONDS)) throw new IOException("No se respondió el permiso de USB");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Se interrumpió el pedido de permiso de USB");
        } finally {
            context.unregisterReceiver(receiver);
        }
        return granted[0];
    }

    // ─── Conexión ───────────────────────────────────────────────────

    static UsbPrinterLink open(Context context, String deviceName) throws IOException {
        UsbDevice device = null;
        for (UsbDevice d : printers(context)) {
            if (deviceName == null || deviceName.isEmpty() || d.getDeviceName().equals(deviceName)) {
                device = d;
                break;
            }
        }
        if (device == null) {
            // El nombre cambia si se desenchufa: se usa la primera impresora USB que haya
            List<UsbDevice> all = printers(context);
            if (all.isEmpty()) throw new IOException("No hay ninguna impresora conectada por USB");
            device = all.get(0);
        }
        UsbInterface iface = ippInterface(device);
        boolean raw = false;
        if (iface == null && device.getVendorId() == VENDOR_EPSON) {
            iface = rawInterface(device);
            raw = iface != null;
        }
        if (iface == null) {
            throw new IOException(displayName(device) + " no tiene IPP por USB ni es Epson: por cable no es compatible (usá WiFi)");
        }
        if (!ensurePermission(context, device)) throw new IOException("No se dio permiso para usar la impresora USB");

        UsbManager manager = (UsbManager) context.getSystemService(Context.USB_SERVICE);
        UsbDeviceConnection conn = manager.openDevice(device);
        if (conn == null) throw new IOException("No se pudo abrir la impresora USB");
        if (!conn.claimInterface(iface, true)) {
            conn.close();
            throw new IOException("La impresora USB está ocupada");
        }
        UsbEndpoint epIn = null;
        UsbEndpoint epOut = null;
        for (int i = 0; i < iface.getEndpointCount(); i++) {
            UsbEndpoint ep = iface.getEndpoint(i);
            if (ep.getType() != UsbConstants.USB_ENDPOINT_XFER_BULK) continue;
            if (ep.getDirection() == UsbConstants.USB_DIR_IN) epIn = ep;
            else epOut = ep;
        }
        // El cable común de solo ida no tiene canal de vuelta
        if (epOut == null || (epIn == null && !raw)) {
            conn.releaseInterface(iface);
            conn.close();
            throw new IOException("La impresora USB no tiene los canales esperados");
        }
        UsbPrinterLink link = new UsbPrinterLink(conn, iface, epIn, epOut, displayName(device), raw, device.getVendorId());
        link.drain();
        return link;
    }

    /** printer-uri que se usa por USB (la impresora no tiene IP: es "localhost"). */
    static String printerUri(String resourcePath) {
        return "ipp://localhost" + IppClient.normalizePath(resourcePath);
    }

    // ─── HTTP por el cable ──────────────────────────────────────────

    @Override
    public byte[] post(String path, byte[] payload) throws IOException {
        String headers = "POST " + path + " HTTP/1.1\r\n"
                + "Host: localhost\r\n"
                + "Content-Type: application/ipp\r\n"
                + "Content-Length: " + payload.length + "\r\n"
                + "User-Agent: EventPix\r\n\r\n";
        write(headers.getBytes(StandardCharsets.US_ASCII));
        write(payload);
        byte[] body = IppClient.readHttpBody(new BufferedInputStream(new BulkInput(), CHUNK));
        drain();
        return body;
    }

    private void write(byte[] data) throws IOException {
        int offset = 0;
        while (offset < data.length) {
            int len = Math.min(CHUNK, data.length - offset);
            byte[] chunk = offset == 0 && len == data.length ? data : Arrays.copyOfRange(data, offset, offset + len);
            int sent = connection.bulkTransfer(out, chunk, len, TIMEOUT_MS);
            if (sent < 0) throw new IOException("Se cortó el envío a la impresora USB");
            offset += sent;
        }
    }

    // ─── Cable común (idioma de la impresora) ───────────────────────

    /**
     * Identificación IEEE 1284 que da la impresora, p. ej.
     * "MFG:EPSON;CMD:ESCPL2,BDC,D4,D4PX,ESCPR1;MDL:L1250 Series;…". Null si no contesta.
     */
    String deviceId() {
        byte[] b = new byte[1024];
        int index = (iface.getId() << 8) | (iface.getAlternateSetting() & 0xFF);
        int n = connection.controlTransfer(0xA1, 0, 0, index, b, b.length, 5000);
        if (n < 2) return null;
        int len = Math.min(n, ((b[0] & 0xFF) << 8) | (b[1] & 0xFF));
        if (len <= 2) return null;
        return new String(b, 2, len - 2, StandardCharsets.US_ASCII).trim();
    }

    /** Un campo de la identificación IEEE 1284 ("MDL", "CMD"…), o null. */
    static String deviceIdField(String deviceId, String... keys) {
        if (deviceId == null) return null;
        for (String part : deviceId.split(";")) {
            int colon = part.indexOf(':');
            if (colon <= 0) continue;
            String key = part.substring(0, colon).trim();
            for (String k : keys) if (key.equalsIgnoreCase(k)) return part.substring(colon + 1).trim();
        }
        return null;
    }

    /**
     * Salida para mandar el trabajo tal cual por el cable. La impresora recibe al ritmo
     * que imprime: si deja de aceptar datos un rato (calienta, limpia cabezales) se
     * espera hasta RAW_STALL_MS antes de dar error.
     */
    java.io.OutputStream rawOutput() {
        return new java.io.OutputStream() {
            private final byte[] buf = new byte[CHUNK];
            private int len;
            private int chunks;

            @Override
            public void write(int b) throws IOException {
                if (len == buf.length) flushBuffer();
                buf[len++] = (byte) b;
            }

            @Override
            public void write(byte[] b, int off, int n) throws IOException {
                while (n > 0) {
                    if (len == buf.length) flushBuffer();
                    int k = Math.min(n, buf.length - len);
                    System.arraycopy(b, off, buf, len, k);
                    len += k;
                    off += k;
                    n -= k;
                }
            }

            @Override
            public void flush() throws IOException {
                flushBuffer();
            }

            private void flushBuffer() throws IOException {
                if (len == 0) return;
                sendWhole(buf, len);
                len = 0;
                // Lo que la impresora contesta (estado) se descarta para que no se le llene
                if (++chunks % 32 == 0) drain();
            }
        };
    }

    /**
     * Manda un bloque entero. Nunca se reenvía: si la impresora deja de aceptar datos un
     * rato (termina la foto anterior, calienta, limpia cabezales) se sigue esperando el
     * mismo envío. Con bulkTransfer, un envío que vence puede haber pasado a medias y
     * reenviarlo duplica bytes: la impresora pierde el hilo (sale una hoja en blanco y
     * se cuelga).
     */
    private void sendWhole(byte[] data, int len) throws IOException {
        if (Build.VERSION.SDK_INT >= 26) {
            android.hardware.usb.UsbRequest request = new android.hardware.usb.UsbRequest();
            if (!request.initialize(connection, out)) throw new IOException("No se pudo preparar el envío a la impresora USB");
            try {
                if (!request.queue(java.nio.ByteBuffer.wrap(data, 0, len))) {
                    throw new IOException("No se pudo mandar a la impresora USB");
                }
                long start = System.currentTimeMillis();
                while (true) {
                    try {
                        android.hardware.usb.UsbRequest done = connection.requestWait(20000);
                        if (done == null) throw new IOException("Se cortó el envío a la impresora USB");
                        return;
                    } catch (java.util.concurrent.TimeoutException e) {
                        if (System.currentTimeMillis() - start > RAW_STALL_MS) {
                            request.cancel();
                            throw new IOException("La impresora USB dejó de recibir (¿sin papel, tapa abierta o desenchufada?)");
                        }
                    }
                }
            } finally {
                request.close();
            }
        }
        // Android viejo: un solo intento largo, sin reenviar
        int sent = connection.bulkTransfer(out, data, len, RAW_STALL_MS);
        if (sent != len) throw new IOException("La impresora USB dejó de recibir (¿sin papel, tapa abierta o desenchufada?)");
    }

    /** Descarta restos de una respuesta anterior (el cable es una sola conversación). */
    private void drain() {
        if (in == null) return;
        byte[] b = new byte[CHUNK];
        for (int i = 0; i < 20; i++) {
            if (connection.bulkTransfer(in, b, b.length, 50) <= 0) return;
        }
    }

    /** Lo que llega por el canal de entrada, como InputStream. */
    private final class BulkInput extends InputStream {
        private final byte[] buf = new byte[CHUNK];
        private int pos;
        private int len;

        private boolean fill() throws IOException {
            for (int tries = 0; tries < 3; tries++) {
                int n = connection.bulkTransfer(in, buf, buf.length, TIMEOUT_MS);
                if (n > 0) {
                    pos = 0;
                    len = n;
                    return true;
                }
            }
            throw new IOException("La impresora USB no respondió");
        }

        @Override
        public int read() throws IOException {
            if (pos >= len) fill();
            return buf[pos++] & 0xff;
        }

        @Override
        public int read(byte[] b, int off, int n) throws IOException {
            if (pos >= len) fill();
            int k = Math.min(n, len - pos);
            System.arraycopy(buf, pos, b, off, k);
            pos += k;
            return k;
        }
    }

    @Override
    public void close() {
        try {
            connection.releaseInterface(iface);
        } finally {
            connection.close();
        }
    }
}
