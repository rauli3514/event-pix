package com.eventpix.app.print;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.MacAddress;
import android.net.ConnectivityManager;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.net.RouteInfo;
import android.net.TransportInfo;
import android.net.wifi.ScanResult;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.net.wifi.WifiNetworkSpecifier;
import android.net.wifi.p2p.WifiP2pConfig;
import android.net.wifi.p2p.WifiP2pGroup;
import android.net.wifi.p2p.WifiP2pInfo;
import android.net.wifi.p2p.WifiP2pManager;
import android.os.Build;
import android.os.Looper;

import java.io.IOException;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import javax.net.SocketFactory;

/**
 * Conecta con la red Wi-Fi Direct de la impresora (p. ej. "DIRECT-D9-EPSON-...")
 * sin un router de por medio:
 *
 *  - MODE_P2P: se une al grupo Wi-Fi Direct de la impresora como cliente P2P.
 *    La WiFi normal sigue conectada, así que hay internet e impresora a la vez.
 *  - MODE_TEMPORARY: si el equipo no puede, pide la red de la impresora solo
 *    mientras dura el envío (WifiNetworkSpecifier) y la suelta al terminar; en
 *    ese rato Android puede cortar la WiFi con internet.
 *
 * Los métodos bloquean: llamarlos desde un hilo de fondo, nunca desde el main.
 */
public final class WifiDirectLink {

    public static final String MODE_P2P = "p2p";
    public static final String MODE_TEMPORARY = "temporary";

    private static final long P2P_TIMEOUT_MS = 20000;
    private static final long TEMPORARY_TIMEOUT_MS = 30000;

    private final Context context;
    private final ConnectivityManager connectivity;
    private WifiP2pManager p2p;
    private WifiP2pManager.Channel channel;

    public WifiDirectLink(Context context) {
        this.context = context.getApplicationContext();
        this.connectivity = (ConnectivityManager) this.context.getSystemService(Context.CONNECTIVITY_SERVICE);
    }

    /** Conexión lista para hablar con la impresora. Llamar a close() al terminar. */
    public static final class Session implements AutoCloseable {
        public final String mode;
        public final String host;
        /** Red de la impresora en modo temporal; null en P2P (las rutas del grupo ya llevan a ella). */
        public final Network network;
        /** Sockets atados a `network`, o null. */
        public final SocketFactory sockets;
        private final Runnable onClose;

        Session(String mode, String host, Network network, Runnable onClose) {
            this.mode = mode;
            this.host = host;
            this.network = network;
            this.sockets = network != null ? network.getSocketFactory() : null;
            this.onClose = onClose;
        }

        @Override
        public void close() {
            if (onClose != null) onClose.run();
        }
    }

    /**
     * @param preferredMode MODE_P2P, MODE_TEMPORARY, o null para probar P2P y si falla el temporal.
     */
    public Session open(String ssid, String passphrase, String preferredMode) throws IOException {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            throw new IOException("Wi-Fi Direct desde la app necesita Android 10 o superior");
        }
        if (MODE_TEMPORARY.equals(preferredMode)) return openTemporary(ssid, passphrase);
        try {
            return openP2p(ssid, passphrase);
        } catch (IOException | SecurityException p2pError) {
            if (MODE_P2P.equals(preferredMode)) {
                throw p2pError instanceof IOException ? (IOException) p2pError : new IOException(p2pError.getMessage());
            }
            try {
                return openTemporary(ssid, passphrase);
            } catch (IOException temporaryError) {
                throw new IOException("Wi-Fi Direct: " + p2pError.getMessage()
                        + " / conexión temporal: " + temporaryError.getMessage());
            }
        }
    }

    /** ¿La red por defecto tiene internet validado? Sirve para el diagnóstico. */
    public boolean hasInternet() {
        Network active = connectivity.getActiveNetwork();
        NetworkCapabilities caps = active != null ? connectivity.getNetworkCapabilities(active) : null;
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }

    // ─── Wi-Fi Direct (P2P) ──────────────────────────────────────────

    private Session openP2p(String ssid, String passphrase) throws IOException {
        if (p2p == null) {
            p2p = (WifiP2pManager) context.getSystemService(Context.WIFI_P2P_SERVICE);
            if (p2p == null) throw new IOException("el equipo no soporta Wi-Fi Direct");
            channel = p2p.initialize(context, Looper.getMainLooper(), null);
            if (channel == null) throw new IOException("no se pudo iniciar Wi-Fi Direct");
        }

        // Si ya estamos en el grupo de la impresora, se reutiliza
        String owner = currentGroupOwner(ssid);
        if (owner != null) return new Session(MODE_P2P, owner, null, null);

        WifiP2pConfig config = new WifiP2pConfig.Builder()
                .setNetworkName(ssid)
                .setPassphrase(passphrase)
                .enablePersistentMode(false)
                .build();
        CountDownLatch requested = new CountDownLatch(1);
        AtomicReference<String> failure = new AtomicReference<>();
        p2p.connect(channel, config, new WifiP2pManager.ActionListener() {
            @Override public void onSuccess() { requested.countDown(); }
            @Override public void onFailure(int reason) {
                failure.set(p2pReason(reason));
                requested.countDown();
            }
        });
        await(requested, 5000, "Wi-Fi Direct no respondió");
        if (failure.get() != null) throw new IOException("no se pudo conectar por Wi-Fi Direct (" + failure.get() + ")");

        long deadline = System.currentTimeMillis() + P2P_TIMEOUT_MS;
        while (System.currentTimeMillis() < deadline) {
            owner = currentGroupOwner(ssid);
            if (owner != null) return new Session(MODE_P2P, owner, null, null);
            sleep(500);
        }
        p2p.cancelConnect(channel, null);
        throw new IOException("la impresora no aceptó la conexión Wi-Fi Direct");
    }

    /** IP de la impresora si estamos conectados como cliente a su grupo, o null. */
    private String currentGroupOwner(String ssid) throws IOException {
        CountDownLatch done = new CountDownLatch(2);
        AtomicReference<WifiP2pInfo> info = new AtomicReference<>();
        AtomicReference<WifiP2pGroup> group = new AtomicReference<>();
        p2p.requestConnectionInfo(channel, i -> { info.set(i); done.countDown(); });
        p2p.requestGroupInfo(channel, g -> { group.set(g); done.countDown(); });
        await(done, 3000, "Wi-Fi Direct no respondió");

        WifiP2pInfo i = info.get();
        WifiP2pGroup g = group.get();
        if (i == null || !i.groupFormed || i.isGroupOwner || i.groupOwnerAddress == null) return null;
        if (g == null || !ssid.equals(g.getNetworkName())) return null;
        return i.groupOwnerAddress.getHostAddress();
    }

    private static String p2pReason(int reason) {
        switch (reason) {
            case WifiP2pManager.P2P_UNSUPPORTED: return "no soportado";
            case WifiP2pManager.BUSY: return "ocupado";
            default: return "error " + reason;
        }
    }

    // ─── Conexión temporal ───────────────────────────────────────────
    // Android pide permiso ("Conectar a dispositivo") en cada pedido de red, salvo
    // que el pedido sea para un punto de acceso exacto (nombre + BSSID) que el
    // usuario ya aprobó: entonces conecta solo. Por eso se guarda el BSSID de la
    // impresora y se usa desde la segunda vez.

    private static final String PREFS = "eventpix_wifi_direct";

    private Session openTemporary(String ssid, String passphrase) throws IOException {
        String bssid = savedBssid(ssid);
        if (bssid == null) bssid = scannedBssid(ssid);
        if (bssid != null) {
            try {
                return requestTemporary(ssid, passphrase, bssid);
            } catch (IOException e) {
                // Por si el equipo no acepta el pedido con BSSID: se prueba solo con el nombre
            }
        }
        return requestTemporary(ssid, passphrase, null);
    }

    private SharedPreferences prefs() {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private String savedBssid(String ssid) {
        return prefs().getString("bssid:" + ssid, null);
    }

    private static boolean validBssid(String b) {
        return b != null && b.matches("(?i)([0-9a-f]{2}:){5}[0-9a-f]{2}") && !b.equals("02:00:00:00:00:00")
                && !b.equals("00:00:00:00:00:00");
    }

    /** BSSID de la impresora en el último escaneo de WiFi (necesita ubicación; si no, null). */
    private String scannedBssid(String ssid) {
        try {
            WifiManager wifi = (WifiManager) context.getSystemService(Context.WIFI_SERVICE);
            if (wifi == null) return null;
            for (ScanResult r : wifi.getScanResults()) {
                if (ssid.equals(r.SSID) && validBssid(r.BSSID)) return r.BSSID;
            }
        } catch (SecurityException ignored) {
            // sin permiso de ubicación
        }
        return null;
    }

    /** Guarda el BSSID de la red recién conectada para no volver a pedir permiso. */
    private void rememberBssid(String ssid, Network n) {
        String bssid = null;
        try {
            NetworkCapabilities caps = connectivity.getNetworkCapabilities(n);
            TransportInfo info = caps != null ? caps.getTransportInfo() : null;
            if (info instanceof WifiInfo) bssid = ((WifiInfo) info).getBSSID();
            if (!validBssid(bssid)) {
                WifiManager wifi = (WifiManager) context.getSystemService(Context.WIFI_SERVICE);
                WifiInfo current = wifi != null ? wifi.getConnectionInfo() : null;
                if (current != null && ssid.equals(stripQuotes(current.getSSID()))) bssid = current.getBSSID();
            }
        } catch (SecurityException ignored) {
            // sin permiso
        }
        if (!validBssid(bssid)) bssid = scannedBssid(ssid);
        if (validBssid(bssid)) prefs().edit().putString("bssid:" + ssid, bssid.toLowerCase()).apply();
    }

    private static String stripQuotes(String s) {
        return s != null && s.length() >= 2 && s.startsWith("\"") && s.endsWith("\"") ? s.substring(1, s.length() - 1) : s;
    }

    private Session requestTemporary(String ssid, String passphrase, String bssid) throws IOException {
        WifiNetworkSpecifier.Builder builder = new WifiNetworkSpecifier.Builder()
                .setSsid(ssid)
                .setWpa2Passphrase(passphrase);
        if (bssid != null) builder.setBssid(MacAddress.fromString(bssid));
        WifiNetworkSpecifier specifier = builder.build();
        NetworkRequest request = new NetworkRequest.Builder()
                .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
                .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .setNetworkSpecifier(specifier)
                .build();

        CountDownLatch ready = new CountDownLatch(1);
        AtomicReference<Network> network = new AtomicReference<>();
        ConnectivityManager.NetworkCallback callback = new ConnectivityManager.NetworkCallback() {
            @Override public void onAvailable(Network n) {
                network.set(n);
                ready.countDown();
            }
            @Override public void onUnavailable() { ready.countDown(); }
        };
        connectivity.requestNetwork(request, callback);
        Runnable release = () -> {
            try {
                connectivity.unregisterNetworkCallback(callback);
            } catch (IllegalArgumentException ignored) {
                // ya liberada
            }
        };

        try {
            await(ready, TEMPORARY_TIMEOUT_MS, "no se pudo conectar a la red de la impresora");
        } catch (IOException e) {
            release.run();
            throw e;
        }
        Network n = network.get();
        if (n == null) {
            release.run();
            throw new IOException("no se pudo conectar a la red " + ssid + " (¿clave correcta?)");
        }
        String host = gatewayOf(n);
        if (host == null) {
            release.run();
            throw new IOException("conectado a " + ssid + " pero sin dirección de la impresora");
        }
        if (bssid == null) rememberBssid(ssid, n);
        else prefs().edit().putString("bssid:" + ssid, bssid.toLowerCase()).apply();
        return new Session(MODE_TEMPORARY, host, n, release);
    }

    /** En la red Wi-Fi Direct de la impresora, la impresora es el gateway. */
    private String gatewayOf(Network n) {
        LinkProperties lp = connectivity.getLinkProperties(n);
        if (lp == null) return null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Inet4Address dhcp = lp.getDhcpServerAddress();
            if (dhcp != null) return dhcp.getHostAddress();
        }
        for (RouteInfo route : lp.getRoutes()) {
            InetAddress gw = route.getGateway();
            if (gw instanceof Inet4Address && !gw.isAnyLocalAddress()) return gw.getHostAddress();
        }
        return null;
    }

    // ─── Utilidades ──────────────────────────────────────────────────

    private static void await(CountDownLatch latch, long timeoutMs, String timeoutMessage) throws IOException {
        try {
            if (!latch.await(timeoutMs, TimeUnit.MILLISECONDS)) throw new IOException(timeoutMessage);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("interrumpido", e);
        }
    }

    private static void sleep(long ms) throws IOException {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("interrumpido", e);
        }
    }
}
