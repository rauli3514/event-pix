package com.eventpix.app.storage;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Respaldo de las fotos del kiosco en el equipo, una carpeta por evento:
 * Imágenes/EventPix/<carpeta>. En Android 10+ va por MediaStore (sin pedir
 * permisos y visible en la galería); en versiones anteriores, a la carpeta de
 * imágenes propia de la app.
 */
@CapacitorPlugin(name = "KioskStorage")
public class KioskStoragePlugin extends Plugin {

    private static final String ROOT = "EventPix";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @Override
    protected void handleOnDestroy() {
        executor.shutdownNow();
    }

    /** Nombre de carpeta seguro: sin barras ni caracteres raros. */
    static String safeName(String name, String fallback) {
        String s = name == null ? "" : name.trim().replaceAll("[\\\\/:*?\"<>|\\n\\r\\t]+", " ").replaceAll("\\s+", " ").trim();
        if (s.startsWith(".")) s = s.substring(1);
        if (s.length() > 60) s = s.substring(0, 60).trim();
        return s.isEmpty() ? fallback : s;
    }

    private static String relativePath(String folder) {
        return Environment.DIRECTORY_PICTURES + "/" + ROOT + "/" + folder + "/";
    }

    private File legacyDir(String folder) {
        File base = getContext().getExternalFilesDir(Environment.DIRECTORY_PICTURES);
        File dir = new File(base, ROOT + "/" + folder);
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        return dir;
    }

    @PluginMethod
    public void saveImage(PluginCall call) {
        String data = call.getString("dataUrl", "");
        String folder = safeName(call.getString("folder"), "EventPix");
        String fileName = safeName(call.getString("fileName"), "foto-" + System.currentTimeMillis() + ".jpg");
        if (data.isEmpty()) {
            call.reject("Falta la imagen");
            return;
        }
        executor.execute(() -> {
            try {
                int comma = data.indexOf(',');
                byte[] bytes = Base64.decode(comma >= 0 ? data.substring(comma + 1) : data, Base64.DEFAULT);
                String mime = data.startsWith("data:image/png") ? "image/png" : "image/jpeg";
                String location;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentResolver resolver = getContext().getContentResolver();
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
                    values.put(MediaStore.Images.Media.MIME_TYPE, mime);
                    values.put(MediaStore.Images.Media.RELATIVE_PATH, relativePath(folder));
                    values.put(MediaStore.Images.Media.IS_PENDING, 1);
                    Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) throw new IOException("No se pudo crear el archivo en la galería");
                    try (OutputStream out = resolver.openOutputStream(uri)) {
                        if (out == null) throw new IOException("No se pudo escribir la foto");
                        out.write(bytes);
                    }
                    values.clear();
                    values.put(MediaStore.Images.Media.IS_PENDING, 0);
                    resolver.update(uri, values, null, null);
                    location = uri.toString();
                } else {
                    File file = new File(legacyDir(folder), fileName);
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
                call.reject("No se pudo guardar la foto: " + e.getMessage(), e);
            }
        });
    }

    /** Fotos de la carpeta, de la más nueva a la más vieja. */
    @PluginMethod
    public void listImages(PluginCall call) {
        String folder = safeName(call.getString("folder"), "EventPix");
        int limit = Math.max(1, call.getInt("limit", 200));
        executor.execute(() -> {
            JSArray items = new JSArray();
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    String[] projection = {MediaStore.Images.Media._ID, MediaStore.Images.Media.DISPLAY_NAME, MediaStore.Images.Media.DATE_ADDED};
                    try (Cursor c = getContext().getContentResolver().query(
                            MediaStore.Images.Media.EXTERNAL_CONTENT_URI, projection,
                            MediaStore.Images.Media.RELATIVE_PATH + "=?", new String[]{relativePath(folder)},
                            MediaStore.Images.Media.DATE_ADDED + " DESC")) {
                        while (c != null && c.moveToNext() && items.length() < limit) {
                            JSObject item = new JSObject();
                            item.put("uri", ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, c.getLong(0)).toString());
                            item.put("name", c.getString(1));
                            item.put("date", c.getLong(2) * 1000);
                            items.put(item);
                        }
                    }
                } else {
                    File[] files = legacyDir(folder).listFiles();
                    if (files != null) {
                        java.util.Arrays.sort(files, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
                        for (File f : files) {
                            if (items.length() >= limit) break;
                            JSObject item = new JSObject();
                            item.put("uri", f.getAbsolutePath());
                            item.put("name", f.getName());
                            item.put("date", f.lastModified());
                            items.put(item);
                        }
                    }
                }
                JSObject ret = new JSObject();
                ret.put("items", items);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("No se pudieron leer las fotos: " + e.getMessage(), e);
            }
        });
    }

    /** Devuelve una foto guardada como data URL, achicada para mostrarla en pantalla. */
    @PluginMethod
    public void readImage(PluginCall call) {
        String uri = call.getString("uri", "");
        int maxSize = Math.max(64, call.getInt("maxSize", 1200));
        executor.execute(() -> {
            try {
                BitmapFactory.Options bounds = new BitmapFactory.Options();
                bounds.inJustDecodeBounds = true;
                try (InputStream in = open(uri)) {
                    BitmapFactory.decodeStream(in, null, bounds);
                }
                int sample = 1;
                while (Math.max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxSize) sample *= 2;
                BitmapFactory.Options opts = new BitmapFactory.Options();
                opts.inSampleSize = sample;
                Bitmap bmp;
                try (InputStream in = open(uri)) {
                    bmp = BitmapFactory.decodeStream(in, null, opts);
                }
                if (bmp == null) throw new IOException("No se pudo leer la foto");
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                bmp.compress(Bitmap.CompressFormat.JPEG, 88, out);
                bmp.recycle();
                JSObject ret = new JSObject();
                ret.put("dataUrl", "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("No se pudo leer la foto: " + e.getMessage(), e);
            }
        });
    }

    private InputStream open(String uri) throws IOException {
        if (uri.startsWith("content://")) {
            InputStream in = getContext().getContentResolver().openInputStream(Uri.parse(uri));
            if (in == null) throw new IOException("No se pudo abrir la foto");
            return in;
        }
        return new java.io.FileInputStream(uri);
    }
}
