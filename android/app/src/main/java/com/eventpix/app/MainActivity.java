package com.eventpix.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.KeyEvent;
import android.webkit.JavascriptInterface;

import com.eventpix.app.net.KioskLinkPlugin;
import com.eventpix.app.net.KioskNetPlugin;
import com.eventpix.app.print.NativePrintPlugin;
import com.eventpix.app.screen.KioskScreenPlugin;
import com.eventpix.app.storage.KioskStoragePlugin;
import com.getcapacitor.BridgeActivity;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class MainActivity extends BridgeActivity {
    private BluetoothServer bluetoothServer;
    private BluetoothClient bluetoothClient;
    // Disparador Bluetooth: mientras el kiosco lo pide, Volumen +/- y Cámara sacan la foto
    private volatile boolean captureShutter = false;

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int code = event.getKeyCode();
        boolean shutterKey = code == KeyEvent.KEYCODE_VOLUME_UP || code == KeyEvent.KEYCODE_VOLUME_DOWN
                || code == KeyEvent.KEYCODE_CAMERA;
        if (captureShutter && shutterKey && getBridge() != null && getBridge().getWebView() != null) {
            if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) {
                getBridge().getWebView().post(() -> getBridge().getWebView()
                        .evaluateJavascript("window.dispatchEvent(new Event('kiosk-shutter'))", null));
            }
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativePrintPlugin.class);
        registerPlugin(KioskStoragePlugin.class);
        registerPlugin(KioskScreenPlugin.class);
        registerPlugin(KioskNetPlugin.class);
        registerPlugin(KioskLinkPlugin.class);
        super.onCreate(savedInstanceState);
        // Kiosco: la pantalla no se apaga ni entra en protector de Android
        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // La página puede fijar su ancho de diseño (vertical: 1080 puntos, ver screenRotation.ts)
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setUseWideViewPort(true);
            getBridge().getWebView().getSettings().setLoadWithOverviewMode(true);
        }
        // Tele colgada en vertical: se gira desde el arranque, sin esperar a la página
        if (getBridge() != null) {
            KioskScreenPlugin.apply(getBridge().getWebView(), KioskScreenPlugin.savedRotation(this));
        }
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

        /** El kiosco pide (o suelta) las teclas del disparador Bluetooth. */
        @JavascriptInterface
        public void setShutterCapture(boolean on) {
            captureShutter = on;
        }

        /** Si esta app es la pantalla de inicio (lanzador) elegida del equipo. */
        @JavascriptInterface
        public boolean isDefaultHome() {
            Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
            ResolveInfo info = context.getPackageManager().resolveActivity(home, PackageManager.MATCH_DEFAULT_ONLY);
            return info != null && info.activityInfo != null
                    && context.getPackageName().equals(info.activityInfo.packageName);
        }

        /** Permiso "Mostrar sobre otras apps": deja abrir la app sola al prender. */
        @JavascriptInterface
        public boolean canStartOnBoot() {
            return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context);
        }

        @JavascriptInterface
        public void openOverlaySettings() {
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + context.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            } catch (Exception e) {
                // Algunas TV box no tienen esa pantalla: la lista general de permisos
                try {
                    Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            Uri.parse("package:" + context.getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                } catch (Exception ignored) {
                    openSettings();
                }
            }
        }

        /** Abre otra app instalada (p. ej. Ingreso VIP). Devuelve false si no está. */
        @JavascriptInterface
        public boolean openApp(String packageName) {
            Intent launch = context.getPackageManager().getLaunchIntentForPackage(packageName);
            if (launch == null) return false;
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(launch);
            return true;
        }

        /** Apps que se pueden abrir, como JSON [{label, packageName}], para elegir desde Ajustes. */
        @JavascriptInterface
        public String listApps() {
            PackageManager pm = context.getPackageManager();
            JSONArray apps = new JSONArray();
            Set<String> seen = new HashSet<>();
            seen.add(context.getPackageName());
            for (String category : new String[]{Intent.CATEGORY_LAUNCHER, Intent.CATEGORY_LEANBACK_LAUNCHER}) {
                Intent query = new Intent(Intent.ACTION_MAIN).addCategory(category);
                List<ResolveInfo> found = pm.queryIntentActivities(query, 0);
                for (ResolveInfo info : found) {
                    String pkg = info.activityInfo.packageName;
                    if (!seen.add(pkg)) continue;
                    try {
                        apps.put(new JSONObject()
                                .put("label", info.loadLabel(pm).toString())
                                .put("packageName", pkg));
                    } catch (Exception ignored) {
                        // se omite esa app
                    }
                }
            }
            return apps.toString();
        }

        /**
         * Sale a Android: abre la pantalla de inicio original del equipo (la otra
         * aplicación de inicio). Si el kiosco es la pantalla de inicio, el botón Home
         * vuelve al kiosco; desde la original se entra a las otras apps.
         * Devuelve false si no hay otra (entonces abre los ajustes de Android).
         */
        @JavascriptInterface
        public boolean openOtherLauncher() {
            PackageManager pm = context.getPackageManager();
            Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
            for (ResolveInfo info : pm.queryIntentActivities(home, 0)) {
                if (info.activityInfo == null) continue;
                String pkg = info.activityInfo.packageName;
                // La propia y el selector de Android ("com.android.settings" FallbackHome) no sirven
                if (context.getPackageName().equals(pkg) || "com.android.settings".equals(pkg)) continue;
                try {
                    Intent launch = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
                            .setClassName(pkg, info.activityInfo.name)
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(launch);
                    return true;
                } catch (Exception ignored) {
                    // se prueba con la siguiente
                }
            }
            openSettings();
            return false;
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
