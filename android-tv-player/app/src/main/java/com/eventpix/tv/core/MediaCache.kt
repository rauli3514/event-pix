package com.eventpix.tv.core

import android.content.Context
import android.os.StatFs
import android.util.Log
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FilterInputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.Collections
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

// Videos e imágenes del contenido guardados en el almacenamiento del equipo.
//
// La web le pasa la lista de archivos que está mostrando (TvBridge.cacheMedia)
// y esta clase los baja de a uno en segundo plano. Cuando un archivo está
// completo, el WebView lo lee del disco en vez de internet (serve(), llamado
// desde WebViewManager.shouldInterceptRequest). Así:
// - si se corta internet, el contenido sigue reproduciéndose;
// - con internet, los videos salen del disco: menos red y sin cortes.
//
// La caché de HTTP del WebView no sirve para esto: es chica y descarta los
// archivos grandes, que son justamente los videos.
//
// Cada archivo se guarda como <sha256 de la URL> con un <hash>.json al lado
// (URL, tipo y tamaño). La fecha de modificación del archivo marca el último
// uso, para borrar primero lo que hace más tiempo no se muestra.
object MediaCache {
    private const val TAG = "MediaCache"
    private const val DIR = "media-cache"
    private const val CONNECT_TIMEOUT_MS = 15_000
    private const val READ_TIMEOUT_MS = 30_000
    // Tope de la caché: el menor entre esto y lo que entra dejando libre RESERVE_MB.
    private const val MAX_CACHE_MB = 4096L
    private const val RESERVE_MB = 500L

    private class Entry(val url: String, val file: File, val mime: String, val size: Long)

    private lateinit var dir: File
    private val entries = ConcurrentHashMap<String, Entry>()
    private val executor = Executors.newSingleThreadExecutor { r -> Thread(r, "MediaCache").apply { priority = Thread.MIN_PRIORITY } }
    // ConcurrentHashMap.newKeySet() recién existe desde Android 7.
    private val queued: MutableSet<String> = Collections.newSetFromMap(ConcurrentHashMap<String, Boolean>())

    @Volatile private var wanted: List<String> = emptyList()
    @Volatile private var downloading: String? = null
    @Volatile private var lastError: String? = null
    @Volatile private var initialized = false

    @Synchronized
    fun init(context: Context) {
        if (initialized) return
        dir = File(context.filesDir, DIR).apply { mkdirs() }
        dir.listFiles()?.forEach { f ->
            if (f.name.endsWith(".part")) f.delete()
        }
        dir.listFiles { f -> f.name.endsWith(".json") }?.forEach { meta ->
            try {
                val json = JSONObject(meta.readText())
                val data = File(dir, meta.name.removeSuffix(".json"))
                val size = json.getLong("size")
                if (data.exists() && data.length() == size) {
                    val url = json.getString("url")
                    entries[url] = Entry(url, data, json.optString("mime", "application/octet-stream"), size)
                } else {
                    meta.delete()
                    data.delete()
                }
            } catch (e: Exception) {
                meta.delete()
            }
        }
        initialized = true
        Log.d(TAG, "Caché lista: ${entries.size} archivos")
    }

    private fun hash(url: String): String =
        MessageDigest.getInstance("SHA-256").digest(url.toByteArray()).joinToString("") { "%02x".format(it) }

    // Lista de archivos que muestra la pantalla ahora. Los que falten se bajan
    // de a uno; los que ya están se marcan como recién usados.
    fun setWanted(urls: List<String>) {
        if (!initialized) return
        val clean = urls.filter { it.startsWith("https://") }.distinct().take(500)
        wanted = clean
        val now = System.currentTimeMillis()
        for (url in clean) {
            val entry = entries[url]
            if (entry != null) {
                entry.file.setLastModified(now)
            } else if (queued.add(url)) {
                executor.execute { downloadSafely(url) }
            }
        }
    }

    private fun downloadSafely(url: String) {
        try {
            if (entries.containsKey(url) || url !in wanted) return
            downloading = url
            download(url)
            lastError = null
        } catch (t: Throwable) {
            Log.w(TAG, "No se pudo guardar $url", t)
            lastError = "${t.javaClass.simpleName}: ${t.message ?: ""}".take(300)
        } finally {
            downloading = null
            queued.remove(url)
        }
    }

    private fun download(url: String) {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = CONNECT_TIMEOUT_MS
        conn.readTimeout = READ_TIMEOUT_MS
        conn.instanceFollowRedirects = true
        try {
            if (conn.responseCode != 200) throw IllegalStateException("HTTP ${conn.responseCode}")
            val expected = conn.contentLength.toLong() // contentLengthLong recién desde API 24
            val mime = conn.contentType?.substringBefore(';')?.trim()?.ifEmpty { null } ?: guessMime(url)

            if (expected > 0 && !makeRoom(expected)) {
                throw IllegalStateException("Sin espacio para ${expected / 1048576} MB")
            }

            val name = hash(url)
            val part = File(dir, "$name.part")
            var written = 0L
            conn.inputStream.use { input ->
                part.outputStream().use { output ->
                    val buffer = ByteArray(64 * 1024)
                    while (true) {
                        val n = input.read(buffer)
                        if (n < 0) break
                        output.write(buffer, 0, n)
                        written += n
                    }
                }
            }
            if (expected > 0 && written != expected) {
                part.delete()
                throw IllegalStateException("Descarga incompleta ($written de $expected bytes)")
            }
            if (expected <= 0 && !makeRoom(0)) {
                part.delete()
                throw IllegalStateException("Sin espacio")
            }

            val data = File(dir, name)
            data.delete()
            if (!part.renameTo(data)) {
                part.delete()
                throw IllegalStateException("No se pudo guardar el archivo")
            }
            File(dir, "$name.json").writeText(
                JSONObject().put("url", url).put("mime", mime).put("size", written).toString()
            )
            entries[url] = Entry(url, data, mime, written)
            Log.d(TAG, "Guardado ${written / 1024} KB: $url")
        } finally {
            conn.disconnect()
        }
    }

    private fun usedBytes(): Long = entries.values.sumOf { it.size }

    private fun quotaBytes(): Long {
        val free = try {
            StatFs(dir.path).let { it.availableBlocksLong * it.blockSizeLong }
        } catch (e: Exception) { 0L }
        val fitsOnDisk = usedBytes() + free - RESERVE_MB * 1048576
        return minOf(MAX_CACHE_MB * 1048576, fitsOnDisk).coerceAtLeast(0)
    }

    // Libera lugar para `needed` bytes borrando lo que hace más tiempo no se usa
    // (nunca lo que la pantalla está mostrando). false si igual no entra.
    @Synchronized
    private fun makeRoom(needed: Long): Boolean {
        val quota = quotaBytes()
        if (usedBytes() + needed <= quota) return true
        val current = wanted.toSet()
        val candidates = entries.values.filter { it.url !in current }.sortedBy { it.file.lastModified() }
        for (entry in candidates) {
            remove(entry)
            if (usedBytes() + needed <= quotaBytes()) return true
        }
        return usedBytes() + needed <= quotaBytes()
    }

    private fun remove(entry: Entry) {
        entries.remove(entry.url)
        entry.file.delete()
        File(dir, "${entry.file.name}.json").delete()
        Log.d(TAG, "Borrado de la caché: ${entry.url}")
    }

    private fun guessMime(url: String): String {
        val path = url.substringBefore('?').lowercase()
        return when {
            path.endsWith(".mp4") || path.endsWith(".m4v") -> "video/mp4"
            path.endsWith(".webm") -> "video/webm"
            path.endsWith(".mov") -> "video/quicktime"
            path.endsWith(".jpg") || path.endsWith(".jpeg") -> "image/jpeg"
            path.endsWith(".png") -> "image/png"
            path.endsWith(".gif") -> "image/gif"
            path.endsWith(".webp") -> "image/webp"
            else -> "application/octet-stream"
        }
    }

    // Respuesta desde el disco para el WebView, o null si el archivo no está
    // (entonces va a internet como siempre). Los videos piden por rangos
    // ("Range: bytes=...") para avanzar o empezar de nuevo: se responde 206.
    fun serve(request: WebResourceRequest): WebResourceResponse? {
        if (!initialized || request.method != "GET") return null
        val entry = entries[request.url.toString()] ?: return null
        if (!entry.file.exists()) {
            entries.remove(entry.url)
            return null
        }
        return try {
            val total = entry.size
            val headers = mutableMapOf(
                "Accept-Ranges" to "bytes",
                "Access-Control-Allow-Origin" to "*",
                "Cache-Control" to "no-store"
            )
            val rangeHeader = request.requestHeaders.entries
                .firstOrNull { it.key.equals("Range", ignoreCase = true) }?.value
            val range = rangeHeader?.let { parseRange(it, total) }
            if (rangeHeader != null && range == null) {
                headers["Content-Range"] = "bytes */$total"
                return WebResourceResponse(entry.mime, null, 416, "Range Not Satisfiable", headers, null)
            }
            if (range != null) {
                val (start, end) = range
                val length = end - start + 1
                val input = FileInputStream(entry.file)
                skipFully(input, start)
                headers["Content-Range"] = "bytes $start-$end/$total"
                headers["Content-Length"] = length.toString()
                WebResourceResponse(entry.mime, null, 206, "Partial Content", headers, LimitedInputStream(input, length))
            } else {
                headers["Content-Length"] = total.toString()
                WebResourceResponse(entry.mime, null, 200, "OK", headers, FileInputStream(entry.file))
            }
        } catch (e: Exception) {
            Log.w(TAG, "No se pudo leer ${entry.url} del disco", e)
            null
        }
    }

    // "bytes=inicio-fin", "bytes=inicio-" o "bytes=-últimos". Un solo rango.
    internal fun parseRange(header: String, total: Long): Pair<Long, Long>? {
        val spec = header.trim().removePrefix("bytes=").substringBefore(',').trim()
        val dash = spec.indexOf('-')
        if (dash < 0 || total <= 0) return null
        val first = spec.substring(0, dash).trim()
        val last = spec.substring(dash + 1).trim()
        val (start, end) = if (first.isEmpty()) {
            val suffix = last.toLongOrNull() ?: return null
            if (suffix <= 0) return null
            maxOf(0, total - suffix) to total - 1
        } else {
            val s = first.toLongOrNull() ?: return null
            val e = if (last.isEmpty()) total - 1 else (last.toLongOrNull() ?: return null)
            s to minOf(e, total - 1)
        }
        if (start < 0 || start > end || start >= total) return null
        return start to end
    }

    private fun skipFully(input: InputStream, bytes: Long) {
        var remaining = bytes
        while (remaining > 0) {
            val skipped = input.skip(remaining)
            if (skipped <= 0) {
                if (input.read() < 0) break
                remaining--
            } else {
                remaining -= skipped
            }
        }
    }

    private class LimitedInputStream(input: InputStream, private var remaining: Long) : FilterInputStream(input) {
        override fun read(): Int {
            if (remaining <= 0) return -1
            val b = super.read()
            if (b >= 0) remaining--
            return b
        }

        override fun read(b: ByteArray, off: Int, len: Int): Int {
            if (remaining <= 0) return -1
            val n = super.read(b, off, minOf(len.toLong(), remaining).toInt())
            if (n > 0) remaining -= n
            return n
        }

        override fun available(): Int = minOf(super.available().toLong(), remaining).toInt()
    }

    // Estado para la telemetría del panel.
    fun status(): JSONObject {
        val current = wanted
        val ready = current.count { entries.containsKey(it) }
        return JSONObject()
            .put("wanted", current.size)
            .put("ready", ready)
            .put("files", entries.size)
            .put("bytes_mb", usedBytes() / 1048576)
            .put("quota_mb", if (initialized) quotaBytes() / 1048576 else 0)
            .put("downloading", downloading ?: JSONObject.NULL)
            .put("last_error", lastError ?: JSONObject.NULL)
    }

    fun parseUrls(json: String): List<String> {
        val array = JSONArray(json)
        return (0 until array.length()).mapNotNull { array.optString(it).takeIf { s -> s.isNotEmpty() } }
    }
}
