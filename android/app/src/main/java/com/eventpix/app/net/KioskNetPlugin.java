package com.eventpix.app.net;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothClass;
import android.bluetooth.BluetoothDevice;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.location.LocationManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.wifi.ScanResult;
import android.net.wifi.WifiConfiguration;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.net.wifi.WifiNetworkSuggestion;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import androidx.annotation.RequiresApi;
import androidx.core.content.ContextCompat;
import androidx.core.location.LocationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * WiFi y Bluetooth desde la app del kiosco, sin pasar por los ajustes de Android (que
 * con la tele vertical se ven de costado).
 *
 * WiFi: busca redes y conecta. En Android 11+ Android no deja que una app conecte sola:
 * se abre el cartel del sistema "¿Guardar esta red?" con la red y la clave ya cargadas
 * (un solo toque en "Guardar"). En Android 10 se sugiere la red; en 9 o menos se conecta
 * directo.
 *
 * Bluetooth: busca dispositivos y los vincula (disparador, parlante, etc.). Si el
 * dispositivo pide un código, Android muestra su cartel.
 */
@CapacitorPlugin(
        name = "KioskNet",
        permissions = {
                @Permission(alias = "location", strings = {
                        Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}),
                @Permission(alias = "bluetooth", strings = {
                        Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT}),
        }
)
public class KioskNetPlugin extends Plugin {

    private static final long WIFI_SCAN_MS = 7000;
    private static final long BT_SCAN_MS = 12000;
    private final Handler main = new Handler(Looper.getMainLooper());

    // ─── WiFi ────────────────────────────────────────────────────────────────

    private WifiManager wifi() {
        return (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
    }

    private boolean locationEnabled() {
        LocationManager lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        return lm != null && LocationManagerCompat.isLocationEnabled(lm);
    }

    @PluginMethod
    public void wifiStatus(PluginCall call) {
        JSObject ret = new JSObject();
        WifiManager wm = wifi();
        ret.put("enabled", wm != null && wm.isWifiEnabled());
        boolean connected = false;
        boolean internet = false;
        try {
            ConnectivityManager cm = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
            Network net = cm != null ? cm.getActiveNetwork() : null;
            NetworkCapabilities caps = net != null ? cm.getNetworkCapabilities(net) : null;
            if (caps != null) {
                connected = caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
                        || caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET);
                internet = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
                ret.put("ethernet", caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET));
            }
        } catch (Exception ignored) {
            // sin datos de red
        }
        ret.put("connected", connected);
        ret.put("internet", internet);
        String ssid = "";
        try {
            WifiInfo info = wm != null ? wm.getConnectionInfo() : null;
            if (info != null && info.getSSID() != null) {
                ssid = info.getSSID().replace("\"", "");
                if (ssid.contains("unknown ssid")) ssid = "";
            }
        } catch (Exception ignored) {
            // sin permiso de ubicación no se ve el nombre
        }
        ret.put("ssid", ssid);
        // Señal de 0 a 4 rayitas (la intensidad no necesita permiso de ubicación)
        try {
            WifiInfo info = wm != null ? wm.getConnectionInfo() : null;
            if (info != null && info.getRssi() > -127 && info.getRssi() < 0) ret.put("bars", WifiManager.calculateSignalLevel(info.getRssi(), 5));
        } catch (Exception ignored) {
            // sin datos de señal
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void wifiScan(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "wifiScanAfterPermission");
            return;
        }
        doWifiScan(call);
    }

    @PermissionCallback
    private void wifiScanAfterPermission(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Sin permiso de ubicación: Android lo pide para buscar redes WiFi", "NO_PERMISSION");
            return;
        }
        doWifiScan(call);
    }

    private void doWifiScan(PluginCall call) {
        WifiManager wm = wifi();
        if (wm == null) {
            call.reject("Este equipo no tiene WiFi", "NO_WIFI");
            return;
        }
        if (!wm.isWifiEnabled()) {
            try {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) wm.setWifiEnabled(true);
            } catch (Exception ignored) {
                // se informa abajo
            }
        }
        final boolean[] done = {false};
        final BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                finishWifiScan(call, this, done);
            }
        };
        ContextCompat.registerReceiver(getContext(), receiver,
                new IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION), ContextCompat.RECEIVER_EXPORTED);
        try {
            wm.startScan();
        } catch (Exception ignored) {
            // Android limita las búsquedas seguidas: se usan los últimos resultados
        }
        main.postDelayed(() -> finishWifiScan(call, receiver, done), WIFI_SCAN_MS);
    }

    private void finishWifiScan(PluginCall call, BroadcastReceiver receiver, boolean[] done) {
        if (done[0]) return;
        done[0] = true;
        try {
            getContext().unregisterReceiver(receiver);
        } catch (Exception ignored) {
            // ya estaba
        }
        WifiManager wm = wifi();
        Map<String, ScanResult> best = new HashMap<>();
        try {
            for (ScanResult r : wm.getScanResults()) {
                if (r.SSID == null || r.SSID.trim().isEmpty()) continue;
                ScanResult prev = best.get(r.SSID);
                if (prev == null || r.level > prev.level) best.put(r.SSID, r);
            }
        } catch (SecurityException e) {
            call.reject("Sin permiso para ver las redes", "NO_PERMISSION");
            return;
        }
        List<ScanResult> list = new ArrayList<>(best.values());
        list.sort((a, b) -> b.level - a.level);
        JSArray networks = new JSArray();
        for (ScanResult r : list) {
            JSObject n = new JSObject();
            n.put("ssid", r.SSID);
            n.put("bars", WifiManager.calculateSignalLevel(r.level, 5));
            n.put("security", securityOf(r.capabilities));
            networks.put(n);
        }
        JSObject ret = new JSObject();
        ret.put("networks", networks);
        ret.put("wifiEnabled", wm.isWifiEnabled());
        ret.put("locationOff", !locationEnabled());
        call.resolve(ret);
    }

    private static String securityOf(String caps) {
        if (caps == null) return "open";
        if (caps.contains("SAE") && !caps.contains("PSK")) return "wpa3";
        if (caps.contains("PSK") || caps.contains("WPA")) return "wpa2";
        if (caps.contains("WEP")) return "wep";
        if (caps.contains("EAP")) return "enterprise";
        return "open";
    }

    @PluginMethod
    public void wifiConnect(PluginCall call) {
        String ssid = call.getString("ssid", "");
        String password = call.getString("password", "");
        String security = call.getString("security", password.isEmpty() ? "open" : "wpa2");
        if (ssid == null || ssid.trim().isEmpty()) {
            call.reject("Falta el nombre de la red");
            return;
        }
        if ("wep".equals(security) || "enterprise".equals(security)) {
            call.reject("Este tipo de red se configura desde los ajustes de Android", "UNSUPPORTED");
            return;
        }
        JSObject ret = new JSObject();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WifiNetworkSuggestion suggestion = buildSuggestion(ssid, password, security);
                Intent intent = new Intent(Settings.ACTION_WIFI_ADD_NETWORKS);
                ArrayList<WifiNetworkSuggestion> list = new ArrayList<>();
                list.add(suggestion);
                intent.putParcelableArrayListExtra(Settings.EXTRA_WIFI_NETWORK_LIST, list);
                if (intent.resolveActivity(getContext().getPackageManager()) != null && getActivity() != null) {
                    getActivity().startActivity(intent);
                    ret.put("method", "dialog");
                } else {
                    wifi().addNetworkSuggestions(list);
                    ret.put("method", "suggestion");
                }
            } else if (Build.VERSION.SDK_INT == Build.VERSION_CODES.Q) {
                ArrayList<WifiNetworkSuggestion> list = new ArrayList<>();
                list.add(buildSuggestion(ssid, password, security));
                wifi().addNetworkSuggestions(list);
                ret.put("method", "suggestion");
            } else {
                legacyConnect(ssid, password);
                ret.put("method", "direct");
            }
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("No se pudo conectar: " + e.getMessage());
        }
    }

    @RequiresApi(api = Build.VERSION_CODES.Q)
    private static WifiNetworkSuggestion buildSuggestion(String ssid, String password, String security) {
        WifiNetworkSuggestion.Builder b = new WifiNetworkSuggestion.Builder().setSsid(ssid);
        if (password != null && !password.isEmpty()) {
            if ("wpa3".equals(security)) b.setWpa3Passphrase(password);
            else b.setWpa2Passphrase(password);
        }
        return b.build();
    }

    @SuppressWarnings("deprecation")
    private void legacyConnect(String ssid, String password) {
        WifiConfiguration conf = new WifiConfiguration();
        conf.SSID = "\"" + ssid + "\"";
        if (password == null || password.isEmpty()) {
            conf.allowedKeyManagement.set(WifiConfiguration.KeyMgmt.NONE);
        } else {
            conf.preSharedKey = "\"" + password + "\"";
        }
        WifiManager wm = wifi();
        int id = wm.addNetwork(conf);
        wm.disconnect();
        wm.enableNetwork(id, true);
        wm.reconnect();
    }

    // ─── Bluetooth ───────────────────────────────────────────────────────────

    private String btAlias() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? "bluetooth" : "location";
    }

    private boolean hasBtPermission() {
        return getPermissionState(btAlias()) == PermissionState.GRANTED;
    }

    @PluginMethod
    public void btStatus(PluginCall call) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        JSObject ret = new JSObject();
        ret.put("supported", adapter != null);
        if (adapter == null) {
            call.resolve(ret);
            return;
        }
        ret.put("enabled", adapter.isEnabled());
        JSArray bonded = new JSArray();
        try {
            Set<BluetoothDevice> devices = adapter.getBondedDevices();
            if (devices != null) for (BluetoothDevice d : devices) bonded.put(deviceJson(d, true));
        } catch (SecurityException ignored) {
            ret.put("needsPermission", true);
        }
        ret.put("bonded", bonded);
        call.resolve(ret);
    }

    @PluginMethod
    @SuppressWarnings("deprecation")
    public void btEnable(PluginCall call) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            call.reject("Este equipo no tiene Bluetooth", "NO_BLUETOOTH");
            return;
        }
        JSObject ret = new JSObject();
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU && adapter.enable()) {
                ret.put("method", "direct");
            } else if (getActivity() != null) {
                getActivity().startActivity(new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE));
                ret.put("method", "dialog");
            }
            call.resolve(ret);
        } catch (SecurityException e) {
            call.reject("Sin permiso para prender el Bluetooth", "NO_PERMISSION");
        }
    }

    @PluginMethod
    public void btScan(PluginCall call) {
        if (!hasBtPermission()) {
            requestPermissionForAlias(btAlias(), call, "btScanAfterPermission");
            return;
        }
        doBtScan(call);
    }

    @PermissionCallback
    private void btScanAfterPermission(PluginCall call) {
        if (!hasBtPermission()) {
            call.reject("Sin permiso: Android lo pide para buscar dispositivos Bluetooth", "NO_PERMISSION");
            return;
        }
        doBtScan(call);
    }

    private void doBtScan(PluginCall call) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            call.reject("Este equipo no tiene Bluetooth", "NO_BLUETOOTH");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("El Bluetooth está apagado", "BT_OFF");
            return;
        }
        final Map<String, JSObject> found = new HashMap<>();
        final boolean[] done = {false};
        final BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (!BluetoothDevice.ACTION_FOUND.equals(intent.getAction())) return;
                BluetoothDevice d = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                if (d == null) return;
                try {
                    found.put(d.getAddress(), deviceJson(d, d.getBondState() == BluetoothDevice.BOND_BONDED));
                } catch (SecurityException ignored) {
                    // sin permiso para leer el nombre
                }
            }
        };
        ContextCompat.registerReceiver(getContext(), receiver,
                new IntentFilter(BluetoothDevice.ACTION_FOUND), ContextCompat.RECEIVER_EXPORTED);
        try {
            if (adapter.isDiscovering()) adapter.cancelDiscovery();
            adapter.startDiscovery();
        } catch (SecurityException e) {
            try { getContext().unregisterReceiver(receiver); } catch (Exception ignored) { /* ya estaba */ }
            call.reject("Sin permiso para buscar dispositivos", "NO_PERMISSION");
            return;
        }
        main.postDelayed(() -> {
            if (done[0]) return;
            done[0] = true;
            try { adapter.cancelDiscovery(); } catch (SecurityException ignored) { /* ya terminó */ }
            try { getContext().unregisterReceiver(receiver); } catch (Exception ignored) { /* ya estaba */ }
            JSArray devices = new JSArray();
            for (JSObject d : found.values()) devices.put(d);
            JSObject ret = new JSObject();
            ret.put("devices", devices);
            ret.put("locationOff", Build.VERSION.SDK_INT < Build.VERSION_CODES.S && !locationEnabled());
            call.resolve(ret);
        }, BT_SCAN_MS);
    }

    @PluginMethod
    public void btPair(PluginCall call) {
        String address = call.getString("address", "");
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null || address == null || !BluetoothAdapter.checkBluetoothAddress(address)) {
            call.reject("Dispositivo no válido");
            return;
        }
        try {
            if (adapter.isDiscovering()) adapter.cancelDiscovery();
            BluetoothDevice d = adapter.getRemoteDevice(address);
            JSObject ret = new JSObject();
            ret.put("started", d.getBondState() == BluetoothDevice.BOND_BONDED || d.createBond());
            call.resolve(ret);
        } catch (SecurityException e) {
            call.reject("Sin permiso para vincular", "NO_PERMISSION");
        }
    }

    @PluginMethod
    public void btUnpair(PluginCall call) {
        String address = call.getString("address", "");
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null || address == null || !BluetoothAdapter.checkBluetoothAddress(address)) {
            call.reject("Dispositivo no válido");
            return;
        }
        try {
            BluetoothDevice d = adapter.getRemoteDevice(address);
            Object ok = d.getClass().getMethod("removeBond").invoke(d);
            JSObject ret = new JSObject();
            ret.put("removed", Boolean.TRUE.equals(ok));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("No se pudo desvincular desde la app", "UNSUPPORTED");
        }
    }

    private static JSObject deviceJson(BluetoothDevice d, boolean bonded) {
        JSObject o = new JSObject();
        String name = null;
        try {
            name = d.getName();
        } catch (SecurityException ignored) {
            // sin nombre
        }
        o.put("name", name == null || name.trim().isEmpty() ? d.getAddress() : name);
        o.put("address", d.getAddress());
        o.put("bonded", bonded);
        String kind = "other";
        try {
            BluetoothClass c = d.getBluetoothClass();
            if (c != null) {
                int major = c.getMajorDeviceClass();
                if (major == BluetoothClass.Device.Major.PERIPHERAL) kind = "input";
                else if (major == BluetoothClass.Device.Major.AUDIO_VIDEO) kind = "audio";
                else if (major == BluetoothClass.Device.Major.PHONE) kind = "phone";
                else if (major == BluetoothClass.Device.Major.IMAGING) kind = "printer";
                else if (major == BluetoothClass.Device.Major.COMPUTER) kind = "computer";
            }
        } catch (SecurityException ignored) {
            // sin datos del tipo
        }
        o.put("kind", kind);
        return o;
    }
}
