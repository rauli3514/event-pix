package com.eventpix.app.update;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.os.Build;
import android.util.Log;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

/**
 * Actualización de la app desde el propio equipo, sin pendrive.
 *
 * El workflow "APK del kiosco" publica en la release fija "kiosco-latest" el APK y un
 * kiosco-version.json con su versión y huella SHA-256 (solo si está firmado con la firma
 * de siempre). Desde Ajustes se descarga, se verifica y se le pasa al instalador de
 * Android, que pide tocar "Instalar": Android no deja que una app se actualice sola.
 *
 * Estado hacia la página: evento 'kioskupdate' con {state, current, latest, progress, message}.
 */
public final class KioskUpdater {

    public interface Emitter {
        void emit(JSONObject detail);
    }

    private static final String TAG = "KioskUpdater";
    private static final String BASE = "https://github.com/rauli3514/event-pix/releases/download/";
    private static final String APK_FILE = "update.apk";

    private final Context context;
    private final Emitter emitter;
    private volatile boolean busy;

    public KioskUpdater(Context context, Emitter emitter) {
        this.context = context.getApplicationContext();
        this.emitter = emitter;
    }

    /** kiosco-latest para el kiosco; las otras variantes (Control, TV) no se actualizan por acá. */
    public static String manifestUrl(Context context) {
        return context.getPackageName().endsWith(".kiosk") ? BASE + "kiosco-latest/kiosco-version.json" : null;
    }

    private static long versionCodeOf(PackageInfo info) {
        return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
    }

    private JSONObject current() throws Exception {
        PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
        return new JSONObject().put("code", versionCodeOf(info)).put("name", info.versionName != null ? info.versionName : "");
    }

    private void emit(String state, JSONObject extra) {
        try {
            extra.put("state", state);
        } catch (Exception ignored) {
            // no pasa
        }
        emitter.emit(extra);
    }

    private static HttpURLConnection open(String url) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(30000);
        conn.setInstanceFollowRedirects(true); // GitHub redirige a su almacenamiento (https → https)
        conn.setRequestProperty("Cache-Control", "no-cache");
        return conn;
    }

    private JSONObject fetchManifest() throws Exception {
        String url = manifestUrl(context);
        if (url == null) throw new IllegalStateException("Esta app no se actualiza desde el equipo");
        HttpURLConnection conn = open(url + "?t=" + System.currentTimeMillis());
        try {
            if (conn.getResponseCode() != 200) throw new IllegalStateException("No hay versión publicada todavía (HTTP " + conn.getResponseCode() + ")");
            try (InputStream in = conn.getInputStream()) {
                return new JSONObject(new String(readAll(in), "UTF-8"));
            }
        } finally {
            conn.disconnect();
        }
    }

    /** Busca si hay una versión más nueva ('available' / 'up_to_date' / 'error'). */
    public void check() {
        if (busy) return;
        new Thread(() -> {
            try {
                JSONObject cur = current();
                emit("checking", new JSONObject().put("current", cur));
                JSONObject m = fetchManifest();
                long latestCode = m.getLong("versionCode");
                JSONObject latest = new JSONObject().put("code", latestCode).put("name", m.optString("versionName"));
                emit(latestCode > cur.getLong("code") ? "available" : "up_to_date",
                        new JSONObject().put("current", cur).put("latest", latest));
            } catch (Exception e) {
                Log.w(TAG, "No se pudo buscar actualización", e);
                emitError(e, "Sin conexión");
            }
        }, "KioskUpdater-check").start();
    }

    /** Descarga, verifica e instala la última versión. */
    public void start() {
        if (busy) return;
        busy = true;
        new Thread(() -> {
            try {
                JSONObject cur = current();
                JSONObject m = fetchManifest();
                long latestCode = m.getLong("versionCode");
                JSONObject latest = new JSONObject().put("code", latestCode).put("name", m.optString("versionName"));
                if (latestCode <= cur.getLong("code")) {
                    emit("up_to_date", new JSONObject().put("current", cur).put("latest", latest));
                    return;
                }
                File apk = download(m.getString("apkUrl"), latest);
                // Huella publicada por el workflow: descarta descargas cortadas o alteradas
                if (!sha256(apk).equalsIgnoreCase(m.getString("sha256"))) {
                    throw new IllegalStateException("La descarga no coincide con la publicada: probá de nuevo");
                }
                PackageInfo archive = context.getPackageManager().getPackageArchiveInfo(apk.getPath(), 0);
                if (archive == null) throw new IllegalStateException("El archivo descargado no es un APK válido");
                if (!context.getPackageName().equals(archive.packageName)) throw new IllegalStateException("El APK es de otra app");
                if (versionCodeOf(archive) <= cur.getLong("code")) throw new IllegalStateException("El APK no es más nuevo");
                emit("installing", new JSONObject().put("current", cur).put("latest", latest));
                install(apk);
            } catch (Exception e) {
                Log.w(TAG, "Falló la actualización", e);
                emitError(e, "Error al actualizar");
            } finally {
                busy = false;
            }
        }, "KioskUpdater-install").start();
    }

    private void emitError(Exception e, String fallback) {
        try {
            emit("error", new JSONObject().put("message", e.getMessage() != null ? e.getMessage() : fallback));
        } catch (Exception ignored) {
            // no pasa
        }
    }

    private File download(String url, JSONObject latest) throws Exception {
        File target = new File(context.getCacheDir(), APK_FILE);
        HttpURLConnection conn = open(url);
        try {
            if (conn.getResponseCode() != 200) throw new IllegalStateException("No se pudo descargar (HTTP " + conn.getResponseCode() + ")");
            long total = conn.getContentLength();
            long done = 0;
            int lastPercent = -1;
            byte[] buf = new byte[64 * 1024];
            try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(target)) {
                int n;
                while ((n = in.read(buf)) >= 0) {
                    out.write(buf, 0, n);
                    done += n;
                    int percent = total > 0 ? (int) (done * 100 / total) : -1;
                    if (percent >= 0 && percent >= lastPercent + 5) {
                        lastPercent = percent;
                        emit("downloading", new JSONObject().put("latest", latest).put("progress", percent));
                    }
                }
            }
        } finally {
            conn.disconnect();
        }
        return target;
    }

    private static String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] buf = new byte[64 * 1024];
        try (InputStream in = new FileInputStream(file)) {
            int n;
            while ((n = in.read(buf)) >= 0) digest.update(buf, 0, n);
        }
        StringBuilder sb = new StringBuilder();
        for (byte b : digest.digest()) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    private static byte[] readAll(InputStream in) throws Exception {
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) >= 0) out.write(buf, 0, n);
        return out.toByteArray();
    }

    /** Instalador oficial de Android; el resultado llega a UpdateStatusReceiver. */
    private void install(File apk) throws Exception {
        PackageInstaller installer = context.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(context.getPackageName());
        int sessionId = installer.createSession(params);
        try (PackageInstaller.Session session = installer.openSession(sessionId)) {
            try (OutputStream out = session.openWrite("eventpix-kiosco.apk", 0, apk.length());
                 InputStream in = new FileInputStream(apk)) {
                byte[] buf = new byte[64 * 1024];
                int n;
                while ((n = in.read(buf)) >= 0) out.write(buf, 0, n);
                session.fsync(out);
            }
            Intent intent = new Intent(context, UpdateStatusReceiver.class);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
            PendingIntent pending = PendingIntent.getBroadcast(context, sessionId, intent, flags);
            session.commit(pending.getIntentSender());
        }
    }
}
