package com.eventpix.tv.core

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.view.PixelCopy
import java.io.ByteArrayOutputStream

// Foto de lo que se ve en la pantalla, para mostrarla en el panel ("¿qué está
// pasando de verdad en la TV?"). Devuelve un JPEG chico en base64, o null.
//
// Desde Android 8 se copia la ventana tal cual llega a la pantalla (incluye
// videos). En equipos más viejos se dibuja la vista: los videos pueden salir
// en negro, pero se ve el resto.
object ScreenCapture {
    private const val TAG = "ScreenCapture"
    private const val JPEG_QUALITY = 60

    fun capture(activity: Activity, maxWidth: Int, done: (String?) -> Unit) {
        activity.runOnUiThread {
            try {
                val root = activity.window.decorView
                val width = root.width
                val height = root.height
                if (width <= 0 || height <= 0) {
                    done(null)
                    return@runOnUiThread
                }
                val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    PixelCopy.request(activity.window, bitmap, { result ->
                        if (result == PixelCopy.SUCCESS) {
                            encodeInBackground(bitmap, maxWidth, done)
                        } else {
                            Log.w(TAG, "PixelCopy falló: $result")
                            bitmap.recycle()
                            done(null)
                        }
                    }, Handler(Looper.getMainLooper()))
                } else {
                    root.draw(Canvas(bitmap))
                    encodeInBackground(bitmap, maxWidth, done)
                }
            } catch (t: Throwable) {
                // Incluye falta de memoria en equipos chicos: no se saca la foto y listo.
                Log.w(TAG, "No se pudo sacar la foto", t)
                done(null)
            }
        }
    }

    private fun encodeInBackground(bitmap: Bitmap, maxWidth: Int, done: (String?) -> Unit) {
        Thread {
            val image = try {
                val targetWidth = maxWidth.coerceIn(160, 1280)
                val scaled = if (bitmap.width > targetWidth) {
                    val targetHeight = (bitmap.height.toLong() * targetWidth / bitmap.width).toInt().coerceAtLeast(1)
                    Bitmap.createScaledBitmap(bitmap, targetWidth, targetHeight, true)
                } else {
                    bitmap
                }
                val out = ByteArrayOutputStream()
                scaled.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out)
                if (scaled !== bitmap) scaled.recycle()
                Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
            } catch (t: Throwable) {
                Log.w(TAG, "No se pudo comprimir la foto", t)
                null
            } finally {
                bitmap.recycle()
            }
            done(image)
        }.start()
    }
}
