package com.eventpix.tv.core

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.util.Log
import android.view.WindowManager
import android.webkit.JavascriptInterface
import java.util.Calendar
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.net.wifi.WifiConfiguration
import android.media.AudioManager
import android.os.SystemClock
import android.os.Build
import android.net.Uri
import android.app.ActivityManager
import android.util.DisplayMetrics
import java.io.File
import java.net.InetAddress
import java.net.NetworkInterface
import java.security.MessageDigest
import java.security.SecureRandom
import org.json.JSONObject

// Puente entre la web (React) y Android.
//
// addJavascriptInterface inyecta este objeto en TODOS los frames del WebView,
// incluidos los iframes de webs externas que muestra la TV. Por eso los
// métodos de abajo no están expuestos a JavaScript: lo están solo los de la
// sección "API para JavaScript" al final, que exigen un token de sesión. La
// app inyecta el token únicamente en el frame principal y solo si la página es
// la nuestra (ver WebViewManager), así que un iframe de otro origen no lo tiene.
class TvBridge(private val activity: MainActivity) {
    
    private val prefs: SharedPreferences = activity.getSharedPreferences("TvSettings", Context.MODE_PRIVATE)

    // Token aleatorio por sesión (128 bits); cambia cada vez que se crea la Activity.
    private val sessionToken: String = ByteArray(16)
        .also { SecureRandom().nextBytes(it) }
        .joinToString("") { "%02x".format(it) }

    // Script que el WebViewManager ejecuta en el frame principal de nuestras páginas.
    fun tokenInjectionScript(): String =
        "(function(){window.__tvBridgeToken='$sessionToken';" +
        "window.dispatchEvent(new Event('tvbridgeready'));})();"

    private fun authorized(token: String?): Boolean {
        val ok = token != null &&
            MessageDigest.isEqual(token.toByteArray(Charsets.UTF_8), sessionToken.toByteArray(Charsets.UTF_8))
        if (!ok) Log.w("TvBridge", "Llamada al puente rechazada: token inválido")
        return ok
    }

    fun exitApp() {
        Log.d("TvBridge", "exitApp called from JS")
        activity.runOnUiThread {
            activity.finishAffinity()
        }
    }

    fun openWifiSettings() {
        try {
            val intent = Intent(android.provider.Settings.ACTION_WIFI_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            activity.startActivity(intent)
        } catch (e: Exception) {
            openSettings()
        }
    }

    fun openSettings() {
        try {
            val intent = Intent(android.provider.Settings.ACTION_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            activity.startActivity(intent)
        } catch (e: Exception) {
            Log.e("TvBridge", "Failed to open settings", e)
        }
    }

    // Ajustes de "app de inicio" (launcher), para poner o sacar EventPix como inicio.
    fun openHomeSettings() {
        try {
            val intent = Intent(android.provider.Settings.ACTION_HOME_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            activity.startActivity(intent)
        } catch (e: Exception) {
            openSettings()
        }
    }

    // Desde Android 10 una app no puede abrirse sola al arrancar el equipo salvo
    // que sea el launcher o tenga el permiso "mostrar sobre otras apps".
    fun canAutoStart(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
            android.provider.Settings.canDrawOverlays(activity)
    }

    fun openAutoStartSettings() {
        val pkg = Uri.parse("package:${activity.packageName}")
        val attempts = listOf(
            Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION, pkg),
            // Algunas Google TV esconden la pantalla anterior: ficha de la app.
            Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg)
        )
        for (intent in attempts) {
            try {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                activity.startActivity(intent)
                return
            } catch (e: Exception) {
                Log.w("TvBridge", "No se pudo abrir ${intent.action}", e)
            }
        }
        openSettings()
    }

    fun getAppVersionCode(): Int = AppUpdater.versionCodeOf(
        activity.packageManager.getPackageInfo(activity.packageName, 0)
    ).toInt()

    fun getDeviceCode(): String {
        var deviceId = prefs.getString("device_id", null)
        if (deviceId.isNullOrEmpty()) {
            val chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
            deviceId = (1..6).map { chars.random() }.joinToString("")
            prefs.edit().putString("device_id", deviceId).apply()
        }
        return deviceId
    }

    fun setAutoBoot(enabled: Boolean) {
        Log.d("TvBridge", "setAutoBoot: $enabled")
        prefs.edit().putBoolean("autoBoot", enabled).apply()
    }

    fun getAutoBoot(): Boolean {
        return prefs.getBoolean("autoBoot", true) // Default is true for Kiosk
    }

    fun setWatchdog(enabled: Boolean) {
        Log.d("TvBridge", "setWatchdog: $enabled")
        prefs.edit().putBoolean("watchdogEnabled", enabled).apply()
    }
    
    fun getWatchdog(): Boolean {
        return prefs.getBoolean("watchdogEnabled", true)
    }

    fun setKeepAwake(enabled: Boolean) {
        Log.d("TvBridge", "setKeepAwake: $enabled")
        prefs.edit().putBoolean("keepAwake", enabled).apply()
        activity.runOnUiThread {
            if (enabled) {
                activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            } else {
                activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
        }
    }
    
    fun getKeepAwake(): Boolean {
        return prefs.getBoolean("keepAwake", true)
    }

    fun setOrientation(landscape: Boolean) {
        Log.d("TvBridge", "setOrientation landscape: $landscape")
        prefs.edit().putBoolean("landscape", landscape).apply()
        activity.runOnUiThread {
            activity.requestedOrientation = if (landscape) {
                android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            } else {
                android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT
            }
        }
    }
    
    fun getOrientation(): Boolean {
        return prefs.getBoolean("landscape", true)
    }

    fun scheduleDailyRestart(hour: Int, minute: Int) {
        Log.d("TvBridge", "scheduleDailyRestart at $hour:$minute")
        prefs.edit().putInt("rebootHour", hour).putInt("rebootMinute", minute).apply()
        
        val alarmManager = activity.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(activity, AppRestartReceiver::class.java).apply {
            putExtra("killProcess", true)
        }
        
        // Use FLAG_IMMUTABLE as required by newer Android versions
        val pendingIntent = PendingIntent.getBroadcast(
            activity, 
            0, 
            intent, 
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Set calendar to the target time
        val calendar = Calendar.getInstance().apply {
            timeInMillis = System.currentTimeMillis()
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
        }

        // If it's already past the time today, set it for tomorrow
        if (calendar.timeInMillis <= System.currentTimeMillis()) {
            calendar.add(Calendar.DAY_OF_YEAR, 1)
        }

        // Set repeating alarm every day
        alarmManager.setRepeating(
            AlarmManager.RTC_WAKEUP,
            calendar.timeInMillis,
            AlarmManager.INTERVAL_DAY,
            pendingIntent
        )
        
        Log.d("TvBridge", "Alarm scheduled for ${calendar.time}")
    }
    
    fun getRebootHour(): Int {
        return prefs.getInt("rebootHour", 3) // Default 3 AM
    }
    
    fun getRebootMinute(): Int {
        return prefs.getInt("rebootMinute", 0)
    }

    fun setVolume(volumePercent: Int) {
        try {
            val audioManager = activity.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            val newVolume = (maxVolume * volumePercent) / 100
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, newVolume, 0)
            Log.d("TvBridge", "Set volume to $volumePercent% ($newVolume/$maxVolume)")
        } catch (e: Exception) {
            Log.e("TvBridge", "Failed to set volume", e)
        }
    }
    
    fun connectToWifi(ssid: String, psk: String): Boolean {
        // Android 10+ no deja que una app agregue redes ni cambie de red sola
        // (addNetwork devuelve -1). Se avisa en el log en vez de fallar en silencio.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            Log.w("TvBridge", "connectToWifi no soportado en Android 10+ (SDK ${Build.VERSION.SDK_INT})")
            return false
        }
        try {
            Log.d("TvBridge", "Attempting to connect to WiFi: $ssid")
            val wifiManager = activity.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            if (!wifiManager.isWifiEnabled) {
                wifiManager.isWifiEnabled = true
            }
            
            // For Android < 10 (API 29), we can use addNetwork
            val conf = WifiConfiguration()
            conf.SSID = "\"" + ssid + "\""
            conf.preSharedKey = "\"" + psk + "\""
            
            val netId = wifiManager.addNetwork(conf)
            if (netId != -1) {
                wifiManager.disconnect()
                val success = wifiManager.enableNetwork(netId, true)
                wifiManager.reconnect()
                return success
            }
        } catch (e: Exception) {
            Log.e("TvBridge", "Failed to connect to WiFi", e)
        }
        return false
    }

    private fun getCpuTemperature(): Double {
        return try {
            val file = File("/sys/class/thermal/thermal_zone0/temp")
            if (file.exists()) {
                val tempStr = file.readText().trim()
                val temp = tempStr.toDouble()
                if (temp > 1000) temp / 1000.0 else temp
            } else {
                -1.0
            }
        } catch (e: Exception) {
            -1.0
        }
    }
    
    private fun getLocalIpAddress(): String {
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            for (intf in interfaces) {
                val addrs = intf.inetAddresses
                for (addr in addrs) {
                    if (!addr.isLoopbackAddress) {
                        val sAddr = addr.hostAddress
                        if (sAddr != null && sAddr.indexOf(':') < 0) { // is IPv4
                            return sAddr
                        }
                    }
                }
            }
        } catch (e: Exception) {}
        return "Unknown"
    }

    fun getTelemetry(): String {
        val bootCount = prefs.getInt("bootCount", 0)
        val crashCount = prefs.getInt("crashCount", 0)
        
        // Accurate OS RAM
        val activityManager = activity.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val memoryInfo = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memoryInfo)
        
        // Use totalMem if available (API 16+), else fallback to runtime memory
        val totalMemory = memoryInfo.totalMem
        val freeMemory = memoryInfo.availMem
        val usedMemory = totalMemory - freeMemory
        
        // Accurate physical storage
        val stat = android.os.StatFs(android.os.Environment.getDataDirectory().path)
        val bytesAvailable = stat.blockSizeLong * stat.availableBlocksLong
        val bytesTotal = stat.blockSizeLong * stat.blockCountLong
        
        val appVersionName = try {
            activity.packageManager.getPackageInfo(activity.packageName, 0).versionName
        } catch (e: Exception) {
            "Unknown"
        }
        
        val androidVersion = android.os.Build.VERSION.RELEASE
        val sdkVersion = android.os.Build.VERSION.SDK_INT
        
        // Display info
        val displayMetrics = DisplayMetrics()
        activity.windowManager.defaultDisplay.getMetrics(displayMetrics)
        val resolution = "${displayMetrics.widthPixels}x${displayMetrics.heightPixels}"
        
        val uptimeHours = SystemClock.elapsedRealtime() / (1000 * 60 * 60)
        val cpuTemp = getCpuTemperature()
        val localIp = getLocalIpAddress()
        
        // WiFi and Network Telemetry
        var networkType = "offline"
        var wifiSignal = 0
        
        try {
            val cm = activity.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            // activeNetwork recién existe desde Android 6 (API 23): en Android 5
            // tiraba NoSuchMethodError y cerraba la app.
            val capabilities = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                cm.getNetworkCapabilities(cm.activeNetwork)
            } else null

            if (capabilities == null && Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                @Suppress("DEPRECATION")
                val info = cm.activeNetworkInfo
                @Suppress("DEPRECATION")
                if (info?.isConnected == true) {
                    networkType = when (info.type) {
                        ConnectivityManager.TYPE_WIFI -> "wifi"
                        ConnectivityManager.TYPE_ETHERNET -> "ethernet"
                        ConnectivityManager.TYPE_MOBILE -> "cellular"
                        else -> "other"
                    }
                }
            } else if (capabilities != null) {
                if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                    networkType = "wifi"
                    val wifiManager = activity.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
                    val info = wifiManager.connectionInfo
                    wifiSignal = info.rssi
                } else if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) {
                    networkType = "ethernet"
                } else if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) {
                    networkType = "cellular"
                }
            }
        } catch (e: Throwable) {
            Log.e("TvBridge", "Error reading network state", e)
        }
        
        val json = """
        {
            "boot_count": $bootCount,
            "crash_count": $crashCount,
            "memory": {
                "max_mb": ${totalMemory / 1048576},
                "used_mb": ${usedMemory / 1048576},
                "free_mb": ${freeMemory / 1048576}
            },
            "storage": {
                "total_mb": ${bytesTotal / 1048576},
                "free_mb": ${bytesAvailable / 1048576}
            },
            "network": {
                "type": "$networkType",
                "wifi_rssi_dbm": $wifiSignal,
                "ip": "$localIp"
            },
            "hardware": {
                "resolution": "$resolution",
                "uptime_hours": $uptimeHours,
                "cpu_temp_c": $cpuTemp,
                "model": "${Build.MANUFACTURER} ${Build.MODEL}"
            },
            "app_version": "$appVersionName",
            "app_version_code": ${getAppVersionCode()},
            "android_version": "$androidVersion (SDK $sdkVersion)",
            "webview": ${JSONObject.quote(CrashReporter.webViewVersion(activity))},
            "media_cache": ${try { MediaCache.status().toString() } catch (t: Throwable) { "null" }},
            "last_crash": ${CrashReporter.lastReason(activity)?.take(1500)?.let { JSONObject.quote(it) } ?: "null"}
        }
        """.trimIndent()
        
        return json
    }
    
    fun resetTelemetry() {
        prefs.edit()
            .putInt("bootCount", 0)
            .putInt("crashCount", 0)
            .apply()
    }

    // -------------------------------------------------------------------------
    // API para JavaScript: mismos nombres que antes, con el token como primer
    // argumento. Sin token válido no hacen nada y los getters devuelven el valor
    // por defecto. (src/lib/tvBridge.ts agrega el token solo.)
    //
    // Todo pasa por safe(): un error dentro de un método llamado desde la web
    // (por ejemplo, una función de Android que no existe en la versión del
    // equipo) cerraría la app entera. Así solo se registra y se devuelve el
    // valor por defecto.
    // -------------------------------------------------------------------------

    private inline fun <T> safe(method: String, fallback: T, block: () -> T): T {
        return try {
            block()
        } catch (t: Throwable) {
            Log.e("TvBridge", "Falló $method", t)
            fallback
        }
    }

    private inline fun call(token: String?, method: String, block: () -> Unit) {
        safe(method, Unit) { if (authorized(token)) block() }
    }

    private inline fun <T> get(token: String?, method: String, fallback: T, block: () -> T): T =
        safe(method, fallback) { if (authorized(token)) block() else fallback }

    // Única llamada sin token: le indica a la web que esta app exige token.
    @JavascriptInterface
    fun getApiVersion(): Int = 2

    @JavascriptInterface
    fun exitApp(token: String?) = call(token, "exitApp") { exitApp() }

    @JavascriptInterface
    fun openWifiSettings(token: String?) = call(token, "openWifiSettings") { openWifiSettings() }

    @JavascriptInterface
    fun openSettings(token: String?) = call(token, "openSettings") { openSettings() }

    @JavascriptInterface
    fun openHomeSettings(token: String?) = call(token, "openHomeSettings") { openHomeSettings() }

    @JavascriptInterface
    fun canAutoStart(token: String?): Boolean = get(token, "canAutoStart", false) { canAutoStart() }

    @JavascriptInterface
    fun openAutoStartSettings(token: String?) = call(token, "openAutoStartSettings") { openAutoStartSettings() }

    // Actualización de la app (ver AppUpdater). El resultado llega como evento 'tvupdate'.
    @JavascriptInterface
    fun checkForUpdate(token: String?) = call(token, "checkForUpdate") { activity.appUpdater.check() }

    @JavascriptInterface
    fun startUpdate(token: String?) = call(token, "startUpdate") { activity.appUpdater.start() }

    @JavascriptInterface
    fun getAppVersionCode(token: String?): Int = get(token, "getAppVersionCode", 0) { getAppVersionCode() }

    @JavascriptInterface
    fun getDeviceCode(token: String?): String = get(token, "getDeviceCode", "") { getDeviceCode() }

    @JavascriptInterface
    fun setAutoBoot(token: String?, enabled: Boolean) = call(token, "setAutoBoot") { setAutoBoot(enabled) }

    @JavascriptInterface
    fun getAutoBoot(token: String?): Boolean = get(token, "getAutoBoot", true) { getAutoBoot() }

    @JavascriptInterface
    fun setWatchdog(token: String?, enabled: Boolean) = call(token, "setWatchdog") { setWatchdog(enabled) }

    @JavascriptInterface
    fun getWatchdog(token: String?): Boolean = get(token, "getWatchdog", true) { getWatchdog() }

    @JavascriptInterface
    fun setKeepAwake(token: String?, enabled: Boolean) = call(token, "setKeepAwake") { setKeepAwake(enabled) }

    @JavascriptInterface
    fun getKeepAwake(token: String?): Boolean = get(token, "getKeepAwake", true) { getKeepAwake() }

    @JavascriptInterface
    fun setOrientation(token: String?, landscape: Boolean) = call(token, "setOrientation") { setOrientation(landscape) }

    @JavascriptInterface
    fun getOrientation(token: String?): Boolean = get(token, "getOrientation", true) { getOrientation() }

    @JavascriptInterface
    fun scheduleDailyRestart(token: String?, hour: Int, minute: Int) =
        call(token, "scheduleDailyRestart") { scheduleDailyRestart(hour, minute) }

    @JavascriptInterface
    fun getRebootHour(token: String?): Int = get(token, "getRebootHour", 3) { getRebootHour() }

    @JavascriptInterface
    fun getRebootMinute(token: String?): Int = get(token, "getRebootMinute", 0) { getRebootMinute() }

    @JavascriptInterface
    fun setVolume(token: String?, volumePercent: Int) = call(token, "setVolume") { setVolume(volumePercent) }

    @JavascriptInterface
    fun connectToWifi(token: String?, ssid: String, psk: String): Boolean =
        get(token, "connectToWifi", false) { connectToWifi(ssid, psk) }

    // Lista (JSON) de las URLs de videos e imágenes que muestra la pantalla:
    // se guardan en el equipo para seguir reproduciendo sin internet.
    @JavascriptInterface
    fun cacheMedia(token: String?, urlsJson: String?) =
        call(token, "cacheMedia") { MediaCache.setWanted(MediaCache.parseUrls(urlsJson ?: "[]")) }

    @JavascriptInterface
    fun getMediaCacheStatus(token: String?): String =
        get(token, "getMediaCacheStatus", "{}") { MediaCache.status().toString() }

    @JavascriptInterface
    fun getTelemetry(token: String?): String = get(token, "getTelemetry", "{}") { getTelemetry() }

    @JavascriptInterface
    fun resetTelemetry(token: String?) = call(token, "resetTelemetry") { resetTelemetry() }
}
