package com.eventpix.app.video;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * App EventPix Video: guarda cada video en la galería del equipo,
 * Películas/EventPix Video/<evento> (Android 10+ por MediaStore, sin permisos).
 *
 * Este archivo no está en el proyecto Android del kiosco: el workflow
 * "APK de EventPix Video" lo copia al compilar solo esa app.
 */
@CapacitorPlugin(name = "VideoStorage")
public class VideoStoragePlugin extends Plugin {

    private static final String ROOT = "EventPix Video";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    /** Videos que se están recibiendo de a partes: id → archivo temporal */
    private final Map<String, File> parts = new HashMap<>();

    @Override
    protected void handleOnDestroy() {
        executor.shutdownNow();
    }

    static String safeName(String name, String fallback) {
        String s = name == null ? "" : name.trim().replaceAll("[\\\\/:*?\"<>|\\n\\r\\t]+", " ").replaceAll("\\s+", " ").trim();
        if (s.startsWith(".")) s = s.substring(1);
        if (s.length() > 60) s = s.substring(0, 60).trim();
        return s.isEmpty() ? fallback : s;
    }

    @PluginMethod
    public void saveVideo(PluginCall call) {
        String data = call.getString("data", "");
        String folder = safeName(call.getString("folder"), "Videos");
        String mime = call.getString("mime", "video/mp4");
        if (mime == null || !mime.startsWith("video/")) mime = "video/mp4";
        String ext = mime.contains("webm") ? ".webm" : ".mp4";
        String fileName = safeName(call.getString("fileName"), "video-" + System.currentTimeMillis() + ext);
        if (data.isEmpty()) {
            call.reject("Falta el video");
            return;
        }
        final String videoMime = mime;
        executor.execute(() -> {
            try {
                int comma = data.indexOf(',');
                byte[] bytes = Base64.decode(comma >= 0 ? data.substring(comma + 1) : data, Base64.DEFAULT);
                String location;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentResolver resolver = getContext().getContentResolver();
                    ContentValues values = new ContentValues();
                    values.put(android.provider.MediaStore.Video.Media.DISPLAY_NAME, fileName);
                    values.put(android.provider.MediaStore.Video.Media.MIME_TYPE, videoMime);
                    values.put(android.provider.MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/" + ROOT + "/" + folder + "/");
                    values.put(android.provider.MediaStore.Video.Media.IS_PENDING, 1);
                    Uri uri = resolver.insert(android.provider.MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) throw new IOException("No se pudo crear el archivo en la galería");
                    try (OutputStream out = resolver.openOutputStream(uri)) {
                        if (out == null) throw new IOException("No se pudo escribir el video");
                        out.write(bytes);
                    }
                    values.clear();
                    values.put(android.provider.MediaStore.Video.Media.IS_PENDING, 0);
                    resolver.update(uri, values, null, null);
                    location = uri.toString();
                } else {
                    File dir = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_MOVIES), ROOT + "/" + folder);
                    //noinspection ResultOfMethodCallIgnored
                    dir.mkdirs();
                    File file = new File(dir, fileName);
                    try (FileOutputStream out = new FileOutputStream(file)) {
                        out.write(bytes);
                    }
                    location = file.getAbsolutePath();
                }
                JSObject ret = new JSObject();
                ret.put("uri", location);
                ret.put("folder", folder);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("No se pudo guardar el video: " + e.getMessage(), e);
            }
        });
    }

    // ─── De a partes (videos largos) ────────────────────────────────────
    // Mandar el video entero de una vez (en base64 por el puente) usa mucha
    // memoria: con un libro de firmas largo la app se cerraba. Ahora llega en
    // partes chicas que se van escribiendo en un archivo temporal.

    @PluginMethod
    public void beginVideo(PluginCall call) {
        String id = UUID.randomUUID().toString();
        File tmp = new File(getContext().getCacheDir(), "video-part-" + id);
        executor.execute(() -> {
            try {
                if (tmp.exists() && !tmp.delete()) throw new IOException("No se pudo preparar el archivo");
                if (!tmp.createNewFile()) throw new IOException("No se pudo crear el archivo temporal");
                synchronized (parts) { parts.put(id, tmp); }
                JSObject ret = new JSObject();
                ret.put("id", id);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("No se pudo empezar a guardar: " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void appendVideo(PluginCall call) {
        String id = call.getString("id", "");
        String data = call.getString("data", "");
        File tmp;
        synchronized (parts) { tmp = parts.get(id); }
        if (tmp == null) {
            call.reject("No hay un video en curso");
            return;
        }
        executor.execute(() -> {
            try (FileOutputStream out = new FileOutputStream(tmp, true)) {
                out.write(Base64.decode(data, Base64.DEFAULT));
                call.resolve();
            } catch (Exception e) {
                call.reject("No se pudo guardar una parte: " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void finishVideo(PluginCall call) {
        String id = call.getString("id", "");
        String folder = safeName(call.getString("folder"), "Videos");
        String mime = call.getString("mime", "video/mp4");
        if (mime == null || !mime.startsWith("video/")) mime = "video/mp4";
        String ext = mime.contains("webm") ? ".webm" : ".mp4";
        String fileName = safeName(call.getString("fileName"), "video-" + System.currentTimeMillis() + ext);
        File tmp;
        synchronized (parts) { tmp = parts.remove(id); }
        if (tmp == null) {
            call.reject("No hay un video en curso");
            return;
        }
        final String videoMime = mime;
        executor.execute(() -> {
            try {
                String location;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentResolver resolver = getContext().getContentResolver();
                    ContentValues values = new ContentValues();
                    values.put(android.provider.MediaStore.Video.Media.DISPLAY_NAME, fileName);
                    values.put(android.provider.MediaStore.Video.Media.MIME_TYPE, videoMime);
                    values.put(android.provider.MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/" + ROOT + "/" + folder + "/");
                    values.put(android.provider.MediaStore.Video.Media.IS_PENDING, 1);
                    Uri uri = resolver.insert(android.provider.MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) throw new IOException("No se pudo crear el archivo en la galería");
                    try (OutputStream out = resolver.openOutputStream(uri); InputStream in = new FileInputStream(tmp)) {
                        if (out == null) throw new IOException("No se pudo escribir el video");
                        copy(in, out);
                    }
                    values.clear();
                    values.put(android.provider.MediaStore.Video.Media.IS_PENDING, 0);
                    resolver.update(uri, values, null, null);
                    location = uri.toString();
                } else {
                    File dir = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_MOVIES), ROOT + "/" + folder);
                    //noinspection ResultOfMethodCallIgnored
                    dir.mkdirs();
                    File file = new File(dir, fileName);
                    try (OutputStream out = new FileOutputStream(file); InputStream in = new FileInputStream(tmp)) {
                        copy(in, out);
                    }
                    location = file.getAbsolutePath();
                }
                JSObject ret = new JSObject();
                ret.put("uri", location);
                ret.put("folder", folder);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("No se pudo guardar el video: " + e.getMessage(), e);
            } finally {
                //noinspection ResultOfMethodCallIgnored
                tmp.delete();
            }
        });
    }

    @PluginMethod
    public void abortVideo(PluginCall call) {
        String id = call.getString("id", "");
        File tmp;
        synchronized (parts) { tmp = parts.remove(id); }
        if (tmp != null) executor.execute(() -> {
            //noinspection ResultOfMethodCallIgnored
            tmp.delete();
        });
        call.resolve();
    }

    private static void copy(InputStream in, OutputStream out) throws IOException {
        byte[] buf = new byte[64 * 1024];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
    }
}
