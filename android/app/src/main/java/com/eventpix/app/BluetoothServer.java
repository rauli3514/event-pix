package com.eventpix.app;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothServerSocket;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.net.wifi.WifiConfiguration;
import android.net.wifi.WifiManager;
import android.net.wifi.WifiNetworkSpecifier;
import android.net.NetworkRequest;
import android.net.ConnectivityManager;
import android.net.Network;
import android.os.Build;
import android.util.Log;
import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.util.UUID;

public class BluetoothServer {
    private static final String TAG = "BluetoothServer";
    private static final String SERVICE_NAME = "EventPixProvisioning";
    private static final UUID SERVICE_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB"); // Standard SPP UUID

    private Context context;
    private BluetoothAdapter bluetoothAdapter;
    private AcceptThread acceptThread;

    public BluetoothServer(Context context) {
        this.context = context;
        this.bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
    }

    public synchronized void start() {
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
            Log.w(TAG, "Bluetooth not supported or not enabled");
            return;
        }

        if (acceptThread != null) {
            acceptThread.cancel();
            acceptThread = null;
        }

        acceptThread = new AcceptThread();
        acceptThread.start();
    }

    public synchronized void stop() {
        if (acceptThread != null) {
            acceptThread.cancel();
            acceptThread = null;
        }
    }

    private class AcceptThread extends Thread {
        private final BluetoothServerSocket serverSocket;
        private boolean isRunning = true;

        public AcceptThread() {
            BluetoothServerSocket tmp = null;
            try {
                tmp = bluetoothAdapter.listenUsingInsecureRfcommWithServiceRecord(SERVICE_NAME, SERVICE_UUID);
            } catch (Exception e) {
                Log.e(TAG, "Socket listen() failed", e);
            }
            serverSocket = tmp;
        }

        public void run() {
            setName("AcceptThread");
            BluetoothSocket socket = null;

            while (isRunning) {
                try {
                    if (serverSocket == null) break;
                    socket = serverSocket.accept();
                } catch (Exception e) {
                    Log.e(TAG, "Socket accept() failed", e);
                    break;
                }

                if (socket != null) {
                    handleConnection(socket);
                }
            }
        }

        public void cancel() {
            isRunning = false;
            try {
                if (serverSocket != null) {
                    serverSocket.close();
                }
            } catch (Exception e) {
                Log.e(TAG, "Could not close server socket", e);
            }
        }
    }

    private void handleConnection(BluetoothSocket socket) {
        try (InputStream inputStream = socket.getInputStream();
             OutputStream outputStream = socket.getOutputStream()) {
            
            byte[] buffer = new byte[1024];
            int bytes = inputStream.read(buffer);
            if (bytes > 0) {
                String message = new String(buffer, 0, bytes);
                Log.d(TAG, "Received message: " + message);
                
                JSONObject json = new JSONObject(message);
                String ssid = json.optString("ssid", "");
                String password = json.optString("password", "");

                boolean success = connectWifi(ssid, password);
                
                JSONObject response = new JSONObject();
                response.put("status", success ? "success" : "failed");
                outputStream.write(response.toString().getBytes());
                outputStream.flush();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error handling connection", e);
        }
    }

    public boolean connectWifi(String ssid, String password) {
        try {
            WifiManager wifiManager = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wifiManager != null && !wifiManager.isWifiEnabled()) {
                wifiManager.setWifiEnabled(true);
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                NetworkRequest.Builder builder = new NetworkRequest.Builder();
                builder.addTransportType(android.net.NetworkCapabilities.TRANSPORT_WIFI);
                WifiNetworkSpecifier specifier = new WifiNetworkSpecifier.Builder()
                        .setSsid(ssid)
                        .setWpa2Passphrase(password)
                        .build();
                builder.setNetworkSpecifier(specifier);
                NetworkRequest request = builder.build();
                ConnectivityManager connectivityManager = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
                connectivityManager.requestNetwork(request, new ConnectivityManager.NetworkCallback() {
                    @Override
                    public void onAvailable(Network network) {
                        connectivityManager.bindProcessToNetwork(network);
                    }
                });
                return true;
            } else {
                WifiConfiguration wifiConfig = new WifiConfiguration();
                wifiConfig.SSID = String.format("\"%s\"", ssid);
                wifiConfig.preSharedKey = String.format("\"%s\"", password);

                int netId = wifiManager.addNetwork(wifiConfig);
                wifiManager.disconnect();
                wifiManager.enableNetwork(netId, true);
                wifiManager.reconnect();
                return true;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error connecting to Wi-Fi", e);
            return false;
        }
    }
}
