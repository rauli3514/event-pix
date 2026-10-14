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
import android.app.ActivityManager
import android.util.DisplayMetrics
import java.io.File
import java.net.InetAddress
import java.net.NetworkInterface
import java.security.MessageDigest
import java.security.SecureRandom

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
            val activeNetwork = cm.activeNetwork
            val capabilities = cm.getNetworkCapabilities(activeNetwork)
            
            if (capabilities != null) {
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
        } catch (e: Exception) {
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
            "android_version": "$androidVersion (SDK $sdkVersion)"
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
    // -------------------------------------------------------------------------

    // Única llamada sin token: le indica a la web que esta app exige token.
    @JavascriptInterface
    fun getApiVersion(): Int = 2

    @JavascriptInterface
    fun exitApp(token: String) { if (authorized(token)) exitApp() }

    @JavascriptInterface
    fun openWifiSettings(token: String) { if (authorized(token)) openWifiSettings() }

    @JavascriptInterface
    fun openSettings(token: String) { if (authorized(token)) openSettings() }

    @JavascriptInterface
    fun getDeviceCode(token: String): String = if (authorized(token)) getDeviceCode() else ""

    @JavascriptInterface
    fun setAutoBoot(token: String, enabled: Boolean) { if (authorized(token)) setAutoBoot(enabled) }

    @JavascriptInterface
    fun getAutoBoot(token: String): Boolean = if (authorized(token)) getAutoBoot() else true

    @JavascriptInterface
    fun setWatchdog(token: String, enabled: Boolean) { if (authorized(token)) setWatchdog(enabled) }

    @JavascriptInterface
    fun getWatchdog(token: String): Boolean = if (authorized(token)) getWatchdog() else true

    @JavascriptInterface
    fun setKeepAwake(token: String, enabled: Boolean) { if (authorized(token)) setKeepAwake(enabled) }

    @JavascriptInterface
    fun getKeepAwake(token: String): Boolean = if (authorized(token)) getKeepAwake() else true

    @JavascriptInterface
    fun setOrientation(token: String, landscape: Boolean) { if (authorized(token)) setOrientation(landscape) }

    @JavascriptInterface
    fun getOrientation(token: String): Boolean = if (authorized(token)) getOrientation() else true

    @JavascriptInterface
    fun scheduleDailyRestart(token: String, hour: Int, minute: Int) {
        if (authorized(token)) scheduleDailyRestart(hour, minute)
    }

    @JavascriptInterface
    fun getRebootHour(token: String): Int = if (authorized(token)) getRebootHour() else 3

    @JavascriptInterface
    fun getRebootMinute(token: String): Int = if (authorized(token)) getRebootMinute() else 0

    @JavascriptInterface
    fun setVolume(token: String, volumePercent: Int) { if (authorized(token)) setVolume(volumePercent) }

    @JavascriptInterface
    fun connectToWifi(token: String, ssid: String, psk: String): Boolean =
        authorized(token) && connectToWifi(ssid, psk)

    @JavascriptInterface
    fun getTelemetry(token: String): String = if (authorized(token)) getTelemetry() else "{}"

    @JavascriptInterface
    fun resetTelemetry(token: String) { if (authorized(token)) resetTelemetry() }
}
