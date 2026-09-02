package com.eventpix.app;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

/**
 * BluetoothClient - Celular se conecta al Tanix como cliente RFCOMM.
 * El Tanix corre BluetoothServer (mismo UUID SPP), el celular se conecta y envía comandos.
 */
public class BluetoothClient {
    private static final String TAG = "BluetoothClient";
    // Mismo UUID SPP que el BluetoothServer del TV
    private static final UUID SERVICE_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private final Context context;
    private final WebView webView;
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothSocket socket;
    private OutputStream outputStream;
    private InputStream inputStream;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public BluetoothClient(Context context, WebView webView) {
        this.context = context;
        this.webView = webView;
        this.bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
    }

    // ── JS Interface ──────────────────────────────────────────────────────────

    @JavascriptInterface
    public String getPairedDevices() {
        try {
            if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
                return "{\"error\":\"bluetooth_disabled\"}";
            }
            Set<BluetoothDevice> paired = bluetoothAdapter.getBondedDevices();
            JSONArray arr = new JSONArray();
            for (BluetoothDevice d : paired) {
                JSONObject obj = new JSONObject();
                obj.put("name", d.getName() != null ? d.getName() : "Unknown");
                obj.put("address", d.getAddress());
                // Filtrar solo dispositivos EventPix
                if (d.getName() != null && d.getName().startsWith("EventPix-TV-")) {
                    arr.put(obj);
                }
            }
            JSONObject result = new JSONObject();
            result.put("devices", arr);
            return result.toString();
        } catch (Exception e) {
            Log.e(TAG, "getPairedDevices error", e);
            return "{\"error\":\"" + e.getMessage() + "\"}";
        }
    }

    @JavascriptInterface
    public void connect(String address) {
        new Thread(() -> {
            try {
                if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
                    notifyJS("onBluetoothEvent", "{\"event\":\"error\",\"message\":\"bluetooth_disabled\"}");
                    return;
                }

                disconnect();

                BluetoothDevice device = bluetoothAdapter.getRemoteDevice(address);
                notifyJS("onBluetoothEvent", "{\"event\":\"connecting\",\"address\":\"" + address + "\"}");

                BluetoothSocket tmp = device.createInsecureRfcommSocketToServiceRecord(SERVICE_UUID);
                bluetoothAdapter.cancelDiscovery();
                tmp.connect();

                socket = tmp;
                outputStream = socket.getOutputStream();
                inputStream = socket.getInputStream();

                notifyJS("onBluetoothEvent", "{\"event\":\"connected\",\"address\":\"" + address + "\",\"name\":\"" + device.getName() + "\"}");

                // Escuchar respuestas del TV
                listenForResponses();

            } catch (Exception e) {
                Log.e(TAG, "connect error", e);
                notifyJS("onBluetoothEvent", "{\"event\":\"error\",\"message\":\"" + e.getMessage() + "\"}");
            }
        }).start();
    }

    @JavascriptInterface
    public void disconnect() {
        try {
            if (outputStream != null) outputStream.close();
            if (inputStream != null) inputStream.close();
            if (socket != null) socket.close();
        } catch (Exception e) {
            Log.w(TAG, "disconnect", e);
        } finally {
            socket = null;
            outputStream = null;
            inputStream = null;
        }
        notifyJS("onBluetoothEvent", "{\"event\":\"disconnected\"}");
    }

    @JavascriptInterface
    public void sendCommand(String jsonCommand) {
        new Thread(() -> {
            try {
                if (outputStream == null) {
                    notifyJS("onBluetoothEvent", "{\"event\":\"error\",\"message\":\"not_connected\"}");
                    return;
                }
                outputStream.write((jsonCommand + "\n").getBytes("UTF-8"));
                outputStream.flush();
                Log.d(TAG, "Sent: " + jsonCommand);
            } catch (Exception e) {
                Log.e(TAG, "sendCommand error", e);
                notifyJS("onBluetoothEvent", "{\"event\":\"error\",\"message\":\"" + e.getMessage() + "\"}");
            }
        }).start();
    }

    @JavascriptInterface
    public boolean isConnected() {
        return socket != null && socket.isConnected();
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private void listenForResponses() {
        new Thread(() -> {
            byte[] buffer = new byte[1024];
            while (socket != null && socket.isConnected()) {
                try {
                    int bytes = inputStream.read(buffer);
                    if (bytes > 0) {
                        String response = new String(buffer, 0, bytes, "UTF-8").trim();
                        Log.d(TAG, "Received: " + response);
                        final String msg = "{\"event\":\"response\",\"data\":" + response + "}";
                        notifyJS("onBluetoothEvent", msg);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "listenForResponses ended", e);
                    notifyJS("onBluetoothEvent", "{\"event\":\"disconnected\"}");
                    break;
                }
            }
        }).start();
    }

    private void notifyJS(String callbackName, String jsonPayload) {
        mainHandler.post(() -> {
            if (webView != null) {
                webView.evaluateJavascript("if(window." + callbackName + ") window." + callbackName + "(" + jsonPayload + ");", null);
            }
        });
    }
}
