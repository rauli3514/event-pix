package com.eventpix.app;

import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private BluetoothServer bluetoothServer;
    private BluetoothClient bluetoothClient;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        bluetoothServer = new BluetoothServer(this);
        // BluetoothClient se inicializa después del Bridge (webview disponible)
    }

    @Override
    public void onResume() {
        super.onResume();
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new AndroidKioskInterface(this), "AndroidKiosk");
            // Inicializar cliente Bluetooth con acceso al WebView para callbacks
            if (bluetoothClient == null) {
                bluetoothClient = new BluetoothClient(this, getBridge().getWebView());
            }
            getBridge().getWebView().addJavascriptInterface(bluetoothClient, "AndroidBluetoothClient");
        }
    }

    @Override
    public void onDestroy() {
        if (bluetoothServer != null) {
            bluetoothServer.stop();
        }
        if (bluetoothClient != null) {
            bluetoothClient.disconnect();
        }
        super.onDestroy();
    }

    private class AndroidKioskInterface {
        private Context context;

        AndroidKioskInterface(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public void openSettings() {
            Intent intent = new Intent(Settings.ACTION_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
        }

        @JavascriptInterface
        public void openWifiSettings() {
            Intent intent = new Intent(Settings.ACTION_WIFI_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
        }

        @JavascriptInterface
        public void startBluetoothServer() {
            if (bluetoothServer != null) {
                bluetoothServer.start();
            }
        }

        @JavascriptInterface
        public void stopBluetoothServer() {
            if (bluetoothServer != null) {
                bluetoothServer.stop();
            }
        }

        @JavascriptInterface
        public void openHomeSettings() {
            try {
                Intent intent = new Intent(Settings.ACTION_HOME_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            } catch (Exception e) {
                openSettings();
            }
        }

        @JavascriptInterface
        public void exitApp() {
            finishAndRemoveTask();
        }

        @JavascriptInterface
        public void setVolume(int level) {
            AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                int maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                int targetVol = (int) ((level / 100.0) * maxVolume);
                audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, targetVol, AudioManager.FLAG_SHOW_UI);
            }
        }
    }
}
