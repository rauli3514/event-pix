package com.eventpix.tv.core

import android.app.ActivityManager
import android.app.AlarmManager
import android.app.ApplicationExitInfo
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.os.Build
import android.util.Log
import android.webkit.WebView
import java.io.PrintWriter
import java.io.StringWriter

// Registro de cierres inesperados.
//
// Antes, si la app fallaba al arrancar, el manejador de errores la reabría a
// los 2 segundos y volvía a fallar: en la TV solo se veía que "vuelve al
// inicio" sin ningún mensaje. Ahora:
// - cada error de Java queda guardado (con commit(): el proceso muere enseguida);
// - en Android 11+ también se lee el motivo que guarda el sistema (crash
//   nativo del WebView, falta de memoria, ANR);
// - si la app se cierra 2 veces seguidas al poco de abrir, deja de reabrirse
//   sola y MainActivity muestra una pantalla con el motivo para sacarle foto.
object CrashReporter {
    private const val TAG = "CrashReporter"
    private const val PREFS = "TvCrash"

    // Una sesión que muere antes de llegar a markStable (MainActivity la llama
    // al minuto de abrir) cuenta como "falla al arrancar".
    // Fallas al arrancar seguidas para dejar de reintentar y mostrar el motivo.
    private const val LOOP_THRESHOLD = 2

    private const val K_SESSION_OPEN = "sessionOpen"
    private const val K_SESSION_START = "sessionStartAt"
    private const val K_STABLE = "sessionStable"
    private const val K_QUICK_DEATHS = "quickDeaths"
    private const val K_CRASH_AT = "lastCrashAt"
    private const val K_CRASH_TEXT = "lastCrashText"
    private const val K_LAST_REASON = "lastReason"

    @Volatile private var installed = false

    data class StartupReport(
        val inLoop: Boolean,
        val quickDeaths: Int,
        // Motivo del último cierre inesperado, si lo hubo.
        val reason: String?
    )

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    // Manejador de errores no capturados (una sola vez por proceso: antes se
    // volvía a encadenar en cada recreate()).
    fun install(context: Context) {
        if (installed) return
        installed = true
        val app = context.applicationContext
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            try {
                Log.e(TAG, "Error no capturado en ${thread.name}", error)
                recordCrash(app, thread.name, error)

                val tvPrefs = app.getSharedPreferences("TvSettings", Context.MODE_PRIVATE)
                tvPrefs.edit().putInt("crashCount", tvPrefs.getInt("crashCount", 0) + 1).commit()

                // Reabrir solo si no viene fallando al arrancar: si no, es un loop
                // infinito que además tapa el motivo.
                val p = prefs(app)
                val diedQuickly = !p.getBoolean(K_STABLE, false)
                val loopSoon = diedQuickly && p.getInt(K_QUICK_DEATHS, 0) + 1 >= LOOP_THRESHOLD
                if (tvPrefs.getBoolean("watchdogEnabled", true) && !loopSoon) {
                    scheduleRestart(app, 99)
                }
            } catch (t: Throwable) {
                Log.e(TAG, "Falló el registro del error", t)
            }
            defaultHandler?.uncaughtException(thread, error)
        }
    }

    fun scheduleRestart(context: Context, requestCode: Int) {
        val intent = Intent(context, AppRestartReceiver::class.java).putExtra("killProcess", true)
        val pending = PendingIntent.getBroadcast(
            context, requestCode, intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.set(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 2000, pending)
    }

    private fun recordCrash(context: Context, threadName: String, error: Throwable) {
        val sw = StringWriter()
        error.printStackTrace(PrintWriter(sw))
        val text = "Hilo $threadName\n$sw".take(6000)
        prefs(context).edit()
            .putLong(K_CRASH_AT, System.currentTimeMillis())
            .putString(K_CRASH_TEXT, text)
            .commit()
    }

    // Se llama al principio de cada onCreate. Mira cómo terminó la sesión anterior.
    fun onLaunch(context: Context): StartupReport {
        val p = prefs(context)
        val now = System.currentTimeMillis()
        val prevStart = p.getLong(K_SESSION_START, 0)
        val prevOpen = p.getBoolean(K_SESSION_OPEN, false)
        val crashAt = p.getLong(K_CRASH_AT, 0)

        // La sesión anterior terminó sin pasar por onStop (o con un error de Java).
        val crashedLastSession = crashAt >= prevStart && prevStart > 0
        val diedUnexpectedly = prevOpen || crashedLastSession

        var reason: String? = null
        var quickDeaths = p.getInt(K_QUICK_DEATHS, 0)

        if (diedUnexpectedly) {
            val quick = !p.getBoolean(K_STABLE, false)
            quickDeaths = if (quick) quickDeaths + 1 else 0

            reason = when {
                crashedLastSession -> p.getString(K_CRASH_TEXT, null)
                else -> systemExitReason(context, prevStart)
                    ?: "La app se cerró sin registrar un error de Java.\n" +
                        "Suele ser una falla del WebView del equipo (Android System WebView) " +
                        "o falta de memoria."
            }
            p.edit().putString(K_LAST_REASON, reason?.take(6000)).apply()
        } else {
            quickDeaths = 0
        }

        p.edit()
            .putBoolean(K_SESSION_OPEN, true)
            .putLong(K_SESSION_START, now)
            .putBoolean(K_STABLE, false)
            .putInt(K_QUICK_DEATHS, quickDeaths)
            .commit()

        return StartupReport(quickDeaths >= LOOP_THRESHOLD, quickDeaths, reason)
    }

    // La app quedó estable (pasó un rato abierta): el contador vuelve a cero.
    fun markStable(context: Context) {
        prefs(context).edit().putBoolean(K_STABLE, true).putInt(K_QUICK_DEATHS, 0).apply()
    }

    // onStart/onStop: salir con HOME o abrir otra app no es un cierre inesperado.
    fun markForeground(context: Context, open: Boolean) {
        prefs(context).edit().putBoolean(K_SESSION_OPEN, open).commit()
    }

    // "Reintentar" desde la pantalla de diagnóstico.
    fun resetLoop(context: Context) {
        prefs(context).edit().putInt(K_QUICK_DEATHS, 0).putBoolean(K_SESSION_OPEN, false).commit()
    }

    // Último motivo registrado (para la telemetría del panel).
    fun lastReason(context: Context): String? = prefs(context).getString(K_LAST_REASON, null)

    // Android 11+: el sistema guarda por qué murió el proceso (incluye crashes nativos).
    private fun systemExitReason(context: Context, since: Long): String? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return null
        return try {
            val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val info = am.getHistoricalProcessExitReasons(context.packageName, 0, 1).firstOrNull()
                ?: return null
            if (info.timestamp < since) return null
            val name = when (info.reason) {
                ApplicationExitInfo.REASON_CRASH -> "error de Java"
                ApplicationExitInfo.REASON_CRASH_NATIVE -> "crash nativo (suele ser el WebView)"
                ApplicationExitInfo.REASON_ANR -> "la app dejó de responder (ANR)"
                ApplicationExitInfo.REASON_LOW_MEMORY -> "falta de memoria"
                ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "uso excesivo de recursos"
                ApplicationExitInfo.REASON_INITIALIZATION_FAILURE -> "falla al iniciar el proceso"
                ApplicationExitInfo.REASON_SIGNALED -> "proceso terminado por el sistema"
                ApplicationExitInfo.REASON_EXIT_SELF -> "la app se cerró sola"
                else -> "código ${info.reason}"
            }
            "Motivo según Android: $name" +
                (info.description?.let { "\n$it" } ?: "") +
                "\nimportancia ${info.importance}, memoria ${info.pss / 1024} MB"
        } catch (t: Throwable) {
            Log.w(TAG, "No se pudo leer el motivo del sistema", t)
            null
        }
    }

    // Datos del equipo para la pantalla de diagnóstico.
    fun deviceSummary(context: Context): String {
        val app = try {
            val info = context.packageManager.getPackageInfo(context.packageName, 0)
            "${info.versionName} (${AppUpdater.versionCodeOf(info)})"
        } catch (t: Throwable) { "?" }
        return "Equipo: ${Build.MANUFACTURER} ${Build.MODEL}\n" +
            "Android ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT})\n" +
            "WebView: ${webViewVersion(context)}\n" +
            "App: $app"
    }

    fun webViewVersion(context: Context): String {
        return try {
            val pkg: PackageInfo? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WebView.getCurrentWebViewPackage()
            } else {
                listOf("com.google.android.webview", "com.android.webview", "com.android.chrome")
                    .firstNotNullOfOrNull { name ->
                        try { context.packageManager.getPackageInfo(name, 0) } catch (e: Exception) { null }
                    }
            }
            if (pkg == null) "no encontrado" else "${pkg.packageName} ${pkg.versionName}"
        } catch (t: Throwable) {
            "no disponible (${t.javaClass.simpleName})"
        }
    }
}
