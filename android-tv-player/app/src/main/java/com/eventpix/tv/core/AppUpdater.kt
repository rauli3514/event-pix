package com.eventpix.tv.core

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageInstaller
import android.os.Build
import android.util.Log
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import kotlin.concurrent.thread

// Actualización de la app desde la TV, sin pendrive.
//
// El workflow "APK de la TV" publica en la release fija "tv-latest" de GitHub
// el APK y un tv-version.json con su versión y huella SHA-256. Desde el menú de
// la TV (o con el comando "Actualizar app" del panel) se descarga, se verifica
// y se le pasa al instalador de Android, que pide confirmar con el control
// remoto: Android no deja que una app se actualice sola sin esa confirmación.
//
// Estado hacia la web: evento 'tvupdate' con {state, current, latest, progress, message}.
class AppUpdater(
    private val context: Context,
    private val emit: (state: String, extra: JSONObject) -> Unit
) {
    companion object {
        private const val TAG = "AppUpdater"
        const val MANIFEST_URL =
            "https://github.com/rauli3514/event-pix/releases/download/tv-latest/tv-version.json"
        private const val APK_FILE = "update.apk"

        fun versionCodeOf(info: PackageInfo): Long =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode
            else @Suppress("DEPRECATION") info.versionCode.toLong()
    }

    @Volatile private var busy = false

    private fun currentInfo(): PackageInfo = context.packageManager.getPackageInfo(context.packageName, 0)

    private fun versionJson(code: Long, name: String?) = JSONObject().put("code", code).put("name", name ?: "")

    private fun currentJson(): JSONObject {
        val info = currentInfo()
        return versionJson(versionCodeOf(info), info.versionName)
    }

    private fun open(url: String): HttpURLConnection {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 15_000
        conn.readTimeout = 30_000
        conn.instanceFollowRedirects = true // GitHub redirige al almacenamiento de releases (https → https)
        conn.setRequestProperty("Cache-Control", "no-cache")
        return conn
    }

    private fun fetchManifest(): JSONObject {
        val conn = open("$MANIFEST_URL?t=${System.currentTimeMillis()}")
        try {
            if (conn.responseCode != 200) throw IllegalStateException("HTTP ${conn.responseCode} al buscar la versión")
            return JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
        } finally {
            conn.disconnect()
        }
    }

    // Busca si hay una versión más nueva. Resultado por evento ('available' / 'up_to_date' / 'error').
    fun check() {
        if (busy) return
        thread(name = "AppUpdater-check") {
            try {
                emit("checking", JSONObject().put("current", currentJson()))
                val manifest = fetchManifest()
                val latestCode = manifest.getLong("versionCode")
                val latest = versionJson(latestCode, manifest.optString("versionName"))
                val current = currentJson()
                val state = if (latestCode > current.getLong("code")) "available" else "up_to_date"
                emit(state, JSONObject().put("current", current).put("latest", latest))
            } catch (e: Exception) {
                Log.e(TAG, "No se pudo buscar actualización", e)
                emit("error", JSONObject().put("message", e.message ?: "Error de red"))
            }
        }
    }

    // Descarga, verifica e instala la última versión.
    fun start() {
        if (busy) return
        busy = true
        thread(name = "AppUpdater-install") {
            try {
                val manifest = fetchManifest()
                val latestCode = manifest.getLong("versionCode")
                val current = currentJson()
                val latest = versionJson(latestCode, manifest.optString("versionName"))
                if (latestCode <= current.getLong("code")) {
                    emit("up_to_date", JSONObject().put("current", current).put("latest", latest))
                    return@thread
                }

                val apk = download(manifest.getString("apkUrl"), latest)

                // Huella publicada por el workflow: descarta descargas cortadas o alteradas.
                val expected = manifest.getString("sha256").lowercase()
                val actual = sha256(apk)
                if (actual != expected) throw IllegalStateException("La descarga no coincide con la publicada (SHA-256)")

                // Tiene que ser esta misma app y una versión mayor.
                val archive = context.packageManager.getPackageArchiveInfo(apk.path, 0)
                    ?: throw IllegalStateException("El archivo descargado no es un APK válido")
                if (archive.packageName != context.packageName) throw IllegalStateException("El APK es de otra app")
                if (versionCodeOf(archive) <= current.getLong("code")) throw IllegalStateException("El APK no es más nuevo")

                emit("installing", JSONObject().put("current", current).put("latest", latest))
                install(apk)
            } catch (e: Exception) {
                Log.e(TAG, "Falló la actualización", e)
                emit("error", JSONObject().put("message", e.message ?: "Error al actualizar"))
            } finally {
                busy = false
            }
        }
    }

    private fun download(url: String, latest: JSONObject): File {
        val target = File(context.cacheDir, APK_FILE)
        val conn = open(url)
        try {
            if (conn.responseCode != 200) throw IllegalStateException("HTTP ${conn.responseCode} al descargar")
            val total = conn.contentLength.toLong() // contentLengthLong recién desde API 24
            var done = 0L
            var lastPercent = -1
            conn.inputStream.use { input ->
                target.outputStream().use { output ->
                    val buffer = ByteArray(64 * 1024)
                    while (true) {
                        val n = input.read(buffer)
                        if (n < 0) break
                        output.write(buffer, 0, n)
                        done += n
                        val percent = if (total > 0) ((done * 100) / total).toInt() else -1
                        if (percent >= 0 && percent >= lastPercent + 5) {
                            lastPercent = percent
                            emit("downloading", JSONObject().put("latest", latest).put("progress", percent))
                        }
                    }
                }
            }
        } finally {
            conn.disconnect()
        }
        return target
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
                val n = input.read(buffer)
                if (n < 0) break
                digest.update(buffer, 0, n)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    // Instalador oficial de Android. El resultado llega a UpdateStatusReceiver,
    // que abre la confirmación ("¿Actualizar esta app?") para el control remoto.
    private fun install(apk: File) {
        val installer = context.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
        params.setAppPackageName(context.packageName)
        val sessionId = installer.createSession(params)
        installer.openSession(sessionId).use { session ->
            session.openWrite("eventpix-tv.apk", 0, apk.length()).use { out ->
                apk.inputStream().use { it.copyTo(out) }
                session.fsync(out)
            }
            val intent = Intent(context, UpdateStatusReceiver::class.java)
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or
                (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
            val pending = PendingIntent.getBroadcast(context, sessionId, intent, flags)
            session.commit(pending.intentSender)
        }
    }
}
