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
import android.view.MotionEvent;
import android.graphics.Matrix;
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

    // Estabilizador de toques (marcos táctiles infrarrojos): al levantar el dedo el marco
    // suele mandar un último punto corrido y el toque cae fuera del botón. Mientras el
    // dedo no se desliza de verdad, todo el toque se toma donde se apoyó.
    private static final String PREFS = "eventpix_kiosk";
    private static final String KEY_TAP_STABILIZE = "tap_stabilize";
    private volatile boolean tapStabilize = true;
    private boolean stabilizing = false;
    private float downX, downY;
    // Anti-rebote: el marco a veces manda un toque como dos seguidos en el mismo lugar
    private static final long BOUNCE_MS = 150;
    private long lastUpTime = 0;
    private float lastUpX, lastUpY;
    private boolean dropping = false;

    // Calibración del marco táctil (Ajustes → Equipo → Marco táctil): corrección que lleva
    // cada toque al lugar real. Se aplica antes que todo lo demás.
    private static final String KEY_TOUCH_MATRIX = "touch_matrix";
    private volatile Matrix touchMatrix = null;
    private TouchCalibrationView calibrationView = null;

    @Override
    public boolean dispatchTouchEvent(MotionEvent raw) {
        // Mientras se calibra, los toques llegan tal cual a las cruces
        if (calibrationView != null || touchMatrix == null) return dispatchStabilized(raw);
        MotionEvent ev = MotionEvent.obtain(raw);
        ev.transform(touchMatrix);
        boolean handled = dispatchStabilized(ev);
        ev.recycle();
        return handled;
    }

    private boolean dispatchStabilized(MotionEvent ev) {
        if (!tapStabilize || calibrationView != null) return super.dispatchTouchEvent(ev);
        int action = ev.getActionMasked();
        // Rebote: toque nuevo enseguida y casi en el mismo lugar que el anterior → se ignora entero
        if (action == MotionEvent.ACTION_DOWN && ev.getEventTime() - lastUpTime < BOUNCE_MS
                && Math.hypot(ev.getX() - lastUpX, ev.getY() - lastUpY) < slopPx() * 1.5f) {
            dropping = true;
            return true;
        }
        if (dropping) {
            if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_CANCEL) {
                dropping = false;
                lastUpTime = ev.getEventTime();
            }
            return true;
        }
        if (action == MotionEvent.ACTION_UP) {
            lastUpTime = ev.getEventTime();
            lastUpX = downX;
            lastUpY = downY;
        }
        if (action == MotionEvent.ACTION_DOWN) {
            downX = ev.getX();
            downY = ev.getY();
            stabilizing = true;
            return super.dispatchTouchEvent(ev);
        }
        // Dos dedos (zoom) o un deslizamiento real: se deja pasar tal cual
        if (action == MotionEvent.ACTION_POINTER_DOWN || ev.getPointerCount() > 1) stabilizing = false;
        if (stabilizing && (action == MotionEvent.ACTION_MOVE || action == MotionEvent.ACTION_UP)) {
            float dx = ev.getX() - downX;
            float dy = ev.getY() - downY;
            if (action == MotionEvent.ACTION_MOVE && Math.hypot(dx, dy) > slopPx()) {
                stabilizing = false;
                return super.dispatchTouchEvent(ev);
            }
            // Movimiento chico (o el punto al levantar): se lleva al lugar donde se apoyó
            MotionEvent fixed = MotionEvent.obtain(ev);
            fixed.offsetLocation(-dx, -dy);
            boolean handled = super.dispatchTouchEvent(fixed);
            fixed.recycle();
            if (action == MotionEvent.ACTION_UP) stabilizing = false;
            return handled;
        }
        if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_CANCEL) stabilizing = false;
        return super.dispatchTouchEvent(ev);
    }

    private Matrix loadTouchMatrix() {
        String saved = getSharedPreferences(PREFS, MODE_PRIVATE).getString(KEY_TOUCH_MATRIX, null);
        if (saved == null) return null;
        try {
            String[] parts = saved.split(",");
            float[] v = new float[9];
            for (int i = 0; i < 9; i++) v[i] = Float.parseFloat(parts[i]);
            Matrix m = new Matrix();
            m.setValues(v);
            return m;
        } catch (Exception e) {
            return null;
        }
    }

    private void saveTouchMatrix(Matrix m) {
        android.content.SharedPreferences.Editor ed = getSharedPreferences(PREFS, MODE_PRIVATE).edit();
        if (m == null) {
            ed.remove(KEY_TOUCH_MATRIX);
        } else {
            float[] v = new float[9];
            m.getValues(v);
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 9; i++) sb.append(i == 0 ? "" : ",").append(v[i]);
            ed.putString(KEY_TOUCH_MATRIX, sb.toString());
        }
        ed.apply();
        touchMatrix = m;
    }

    /** Muestra las cruces de calibración; al terminar avisa a la página (evento kiosk-touch-calibrated). */
    private void startTouchCalibration() {
        if (calibrationView != null) return;
        float rotation = getBridge() != null && getBridge().getWebView() != null ? getBridge().getWebView().getRotation() : 0f;
        calibrationView = new TouchCalibrationView(this, rotation, correction -> {
            android.view.ViewGroup parent = (android.view.ViewGroup) calibrationView.getParent();
            if (parent != null) parent.removeView(calibrationView);
            calibrationView = null;
            if (correction != null) saveTouchMatrix(correction);
            String result = correction != null ? "true" : "false";
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('kiosk-touch-calibrated',{detail:" + result + "}))", null);
            }
        });
        addContentView(calibrationView, new android.view.ViewGroup.LayoutParams(
                android.view.ViewGroup.LayoutParams.MATCH_PARENT, android.view.ViewGroup.LayoutParams.MATCH_PARENT));
    }

    /** Cuánto se tiene que mover el dedo para que cuente como deslizar (4 % del lado corto). */
    private float slopPx() {
        android.util.DisplayMetrics m = getResources().getDisplayMetrics();
        return Math.min(m.widthPixels, m.heightPixels) * 0.04f;
    }

    // Plan B del disparador: en muchas TV box el sistema se queda con las teclas de volumen
    // y no llegan a la app. Mientras el kiosco espera el disparador se vigila el volumen:
    // si cambia, cuenta como el botón y el volumen vuelve a donde estaba.
    private android.content.BroadcastReceiver volumeReceiver;
    private long ignoreVolumeUntil = 0;
    private long lastVolumeShot = 0;

    private void fireShutter() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        getBridge().getWebView().post(() -> getBridge().getWebView()
                .evaluateJavascript("window.dispatchEvent(new Event('kiosk-shutter'))", null));
    }

    private void startVolumeWatch() {
        if (volumeReceiver != null) return;
        AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (am == null) return;
        // Con el volumen al máximo (o en cero) apretar no lo cambia: se deja un paso de margen
        int max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        int cur = am.getStreamVolume(AudioManager.STREAM_MUSIC);
        ignoreVolumeUntil = android.os.SystemClock.uptimeMillis() + 400;
        if (cur >= max && max > 1) am.setStreamVolume(AudioManager.STREAM_MUSIC, max - 1, 0);
        else if (cur <= 0) am.setStreamVolume(AudioManager.STREAM_MUSIC, 1, 0);
        volumeReceiver = new android.content.BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (!captureShutter) return;
                int stream = intent.getIntExtra("android.media.EXTRA_VOLUME_STREAM_TYPE", -1);
                int now = intent.getIntExtra("android.media.EXTRA_VOLUME_STREAM_VALUE", -1);
                int prev = intent.getIntExtra("android.media.EXTRA_PREV_VOLUME_STREAM_VALUE", -1);
                if (stream < 0 || now < 0 || prev < 0 || now == prev) return;
                long t = android.os.SystemClock.uptimeMillis();
                if (t < ignoreVolumeUntil) return; // el cambio lo hizo la app al devolverlo
                // Se devuelve el volumen y se saca la foto (una vez por apretada)
                ignoreVolumeUntil = t + 300;
                am.setStreamVolume(stream, prev, 0);
                if (t - lastVolumeShot < 500) return;
                lastVolumeShot = t;
                fireShutter();
            }
        };
        androidx.core.content.ContextCompat.registerReceiver(this, volumeReceiver,
                new android.content.IntentFilter("android.media.VOLUME_CHANGED_ACTION"),
                androidx.core.content.ContextCompat.RECEIVER_EXPORTED);
    }

    private void stopVolumeWatch() {
        if (volumeReceiver == null) return;
        try { unregisterReceiver(volumeReceiver); } catch (Exception ignored) { /* ya estaba */ }
        volumeReceiver = null;
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int code = event.getKeyCode();
        boolean shutterKey = code == KeyEvent.KEYCODE_VOLUME_UP || code == KeyEvent.KEYCODE_VOLUME_DOWN
                || code == KeyEvent.KEYCODE_CAMERA;
        if (captureShutter && shutterKey && getBridge() != null && getBridge().getWebView() != null) {
            if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) {
                lastVolumeShot = android.os.SystemClock.uptimeMillis();
                fireShutter();
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
        tapStabilize = getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean(KEY_TAP_STABILIZE, true);
        touchMatrix = loadTouchMatrix();
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
        stopVolumeWatch();
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

        /** Estabilizador de toques para marcos táctiles (Ajustes → Equipo). Queda guardado. */
        @JavascriptInterface
        public void setTapStabilize(boolean on) {
            tapStabilize = on;
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(KEY_TAP_STABILIZE, on).apply();
        }

        @JavascriptInterface
        public boolean getTapStabilize() {
            return tapStabilize;
        }

        /** Calibrar el marco táctil (cruces en las esquinas). */
        @JavascriptInterface
        public void calibrateTouch() {
            runOnUiThread(MainActivity.this::startTouchCalibration);
        }

        @JavascriptInterface
        public void resetTouchCalibration() {
            runOnUiThread(() -> saveTouchMatrix(null));
        }

        @JavascriptInterface
        public boolean isTouchCalibrated() {
            return touchMatrix != null;
        }

        /** El kiosco pide (o suelta) las teclas del disparador Bluetooth. */
        @JavascriptInterface
        public void setShutterCapture(boolean on) {
            captureShutter = on;
            runOnUiThread(() -> { if (on) startVolumeWatch(); else stopVolumeWatch(); });
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
