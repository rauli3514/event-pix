package com.eventpix.app.net;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothServerSocket;
import android.bluetooth.BluetoothSocket;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Enlace Bluetooth entre la pantalla del kiosco (TV box) y una tablet que la maneja,
 * sin internet. Un canal RFCOMM con mensajes JSON de una línea:
 *  - la pantalla ("host") escucha y acepta una tablet a la vez;
 *  - la tablet ("remote") se conecta con la dirección de la pantalla.
 * Eventos para la página: "linkState" {state, name} y "linkMessage" {data}.
 */
@CapacitorPlugin(
        name = "KioskLink",
        permissions = {
                @Permission(alias = "bluetooth", strings = {
                        Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN}),
        }
)
public class KioskLinkPlugin extends Plugin {

    private static final String TAG = "KioskLink";
    private static final String SERVICE = "EventPixKioskLink";
    private static final UUID SERVICE_UUID = UUID.fromString("7d3f2b8e-5a1c-4e6f-9b2d-0c8a4e1f6a35");

    private final Object lock = new Object();
    private BluetoothServerSocket serverSocket;
    private Thread acceptThread;
    private BluetoothSocket socket;
    private OutputStream out;
    private volatile boolean hosting = false;

    private boolean hasPermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S || getPermissionState("bluetooth") == PermissionState.GRANTED;
    }

    private void emitState(String state, String name) {
        JSObject o = new JSObject();
        o.put("state", state);
        if (name != null) o.put("name", name);
        notifyListeners("linkState", o, true);
    }

    @PluginMethod
    public void info(PluginCall call) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        JSObject ret = new JSObject();
        ret.put("supported", adapter != null);
        if (adapter != null) {
            ret.put("enabled", adapter.isEnabled());
            try {
                ret.put("name", adapter.getName());
            } catch (SecurityException ignored) {
                // sin permiso para leer el nombre
            }
        }
        synchronized (lock) {
            ret.put("hosting", hosting);
            ret.put("connected", socket != null && socket.isConnected());
        }
        call.resolve(ret);
    }

    // ─── Pantalla (host) ─────────────────────────────────────────────────────

    @PluginMethod
    public void startHost(PluginCall call) {
        if (!hasPermission()) {
            requestPermissionForAlias("bluetooth", call, "startHostAfterPermission");
            return;
        }
        doStartHost(call);
    }

    @PermissionCallback
    private void startHostAfterPermission(PluginCall call) {
        if (!hasPermission()) {
            call.reject("Sin permiso de Bluetooth", "NO_PERMISSION");
            return;
        }
        doStartHost(call);
    }

    private void doStartHost(PluginCall call) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            call.reject("El Bluetooth está apagado", "BT_OFF");
            return;
        }
        synchronized (lock) {
            if (hosting) {
                call.resolve();
                return;
            }
            hosting = true;
        }
        acceptThread = new Thread(() -> {
            while (hosting) {
                try {
                    BluetoothServerSocket server = adapter.listenUsingInsecureRfcommWithServiceRecord(SERVICE, SERVICE_UUID);
                    synchronized (lock) { serverSocket = server; }
                    emitState("listening", null);
                    BluetoothSocket s = server.accept();
                    try { server.close(); } catch (IOException ignored) { /* una tablet a la vez */ }
                    if (s != null) runConnection(s);
                } catch (Exception e) {
                    if (!hosting) break;
                    Log.w(TAG, "accept falló, se reintenta", e);
                    try { Thread.sleep(2000); } catch (InterruptedException ie) { break; }
                }
            }
        }, "KioskLinkAccept");
        acceptThread.start();
        call.resolve();
    }

    @PluginMethod
    public void stopHost(PluginCall call) {
        synchronized (lock) {
            hosting = false;
            try { if (serverSocket != null) serverSocket.close(); } catch (IOException ignored) { /* ya cerrado */ }
            serverSocket = null;
        }
        closeSocket();
        emitState("stopped", null);
        call.resolve();
    }

    /** Pide a Android que la pantalla sea visible unos minutos para encontrarla desde la tablet. */
    @PluginMethod
    public void makeDiscoverable(PluginCall call) {
        if (getActivity() == null) {
            call.reject("Sin actividad");
            return;
        }
        Intent intent = new Intent(BluetoothAdapter.ACTION_REQUEST_DISCOVERABLE);
        intent.putExtra(BluetoothAdapter.EXTRA_DISCOVERABLE_DURATION, 300);
        try {
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("No se pudo hacer visible: " + e.getMessage());
        }
    }

    // ─── Tablet (remote) ─────────────────────────────────────────────────────

    @PluginMethod
    public void connect(PluginCall call) {
        if (!hasPermission()) {
            requestPermissionForAlias("bluetooth", call, "connectAfterPermission");
            return;
        }
        doConnect(call);
    }

    @PermissionCallback
    private void connectAfterPermission(PluginCall call) {
        if (!hasPermission()) {
            call.reject("Sin permiso de Bluetooth", "NO_PERMISSION");
            return;
        }
        doConnect(call);
    }

    private void doConnect(PluginCall call) {
        String address = call.getString("address", "");
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null || address == null || !BluetoothAdapter.checkBluetoothAddress(address)) {
            call.reject("Pantalla no válida");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("El Bluetooth está apagado", "BT_OFF");
            return;
        }
        new Thread(() -> {
            try {
                if (adapter.isDiscovering()) adapter.cancelDiscovery();
                BluetoothDevice device = adapter.getRemoteDevice(address);
                BluetoothSocket s = device.createInsecureRfcommSocketToServiceRecord(SERVICE_UUID);
                s.connect();
                closeSocket();
                JSObject ret = new JSObject();
                String name = null;
                try { name = device.getName(); } catch (SecurityException ignored) { /* sin nombre */ }
                ret.put("name", name);
                call.resolve(ret);
                runConnection(s);
            } catch (Exception e) {
                call.reject("No se pudo conectar con la pantalla. ¿Está prendida y con el control por tablet activado?", "CONNECT_FAILED");
            }
        }, "KioskLinkConnect").start();
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        closeSocket();
        call.resolve();
    }

    // ─── Canal ───────────────────────────────────────────────────────────────

    @PluginMethod
    public void send(PluginCall call) {
        String data = call.getString("data", "");
        OutputStream o;
        synchronized (lock) { o = out; }
        if (o == null) {
            call.reject("Sin conexión", "NOT_CONNECTED");
            return;
        }
        try {
            byte[] bytes = (data.replace('\n', ' ') + "\n").getBytes(StandardCharsets.UTF_8);
            synchronized (o) {
                o.write(bytes);
                o.flush();
            }
            call.resolve();
        } catch (IOException e) {
            closeSocket();
            call.reject("Se cortó la conexión", "NOT_CONNECTED");
        }
    }

    /** Lee mensajes hasta que se corta (corre en el hilo de la conexión). */
    private void runConnection(BluetoothSocket s) {
        String name = null;
        try { name = s.getRemoteDevice().getName(); } catch (SecurityException ignored) { /* sin nombre */ }
        try {
            synchronized (lock) {
                socket = s;
                out = s.getOutputStream();
            }
            emitState("connected", name);
            BufferedReader reader = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.UTF_8));
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isEmpty()) continue;
                JSObject msg = new JSObject();
                msg.put("data", line);
                notifyListeners("linkMessage", msg);
            }
        } catch (IOException e) {
            Log.i(TAG, "conexión terminada: " + e.getMessage());
        } finally {
            synchronized (lock) {
                if (socket == s) {
                    socket = null;
                    out = null;
                }
            }
            try { s.close(); } catch (IOException ignored) { /* ya cerrado */ }
            emitState("disconnected", name);
        }
    }

    private void closeSocket() {
        BluetoothSocket s;
        synchronized (lock) {
            s = socket;
            socket = null;
            out = null;
        }
        if (s != null) {
            try { s.close(); } catch (IOException ignored) { /* ya cerrado */ }
        }
    }

    @Override
    protected void handleOnDestroy() {
        hosting = false;
        try { if (serverSocket != null) serverSocket.close(); } catch (IOException ignored) { /* ya cerrado */ }
        closeSocket();
        super.handleOnDestroy();
    }
}
