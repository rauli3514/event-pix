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

class TvBridge(private val activity: MainActivity) {
    
    private val prefs: SharedPreferences = activity.getSharedPreferences("TvSettings", Context.MODE_PRIVATE)

    @JavascriptInterface
    fun exitApp() {
        Log.d("TvBridge", "exitApp called from JS")
        activity.runOnUiThread {
            activity.finishAffinity()
        }
    }

    @JavascriptInterface
    fun openWifiSettings() {
        try {
            val intent = Intent(android.provider.Settings.ACTION_WIFI_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            activity.startActivity(intent)
        } catch (e: Exception) {
            openSettings()
        }
    }

    @JavascriptInterface
    fun openSettings() {
        try {
            val intent = Intent(android.provider.Settings.ACTION_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            activity.startActivity(intent)
        } catch (e: Exception) {
            Log.e("TvBridge", "Failed to open settings", e)
        }
    }

    @JavascriptInterface
    fun getDeviceCode(): String {
        var deviceId = prefs.getString("device_id", null)
        if (deviceId.isNullOrEmpty()) {
            val chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
            deviceId = (1..6).map { chars.random() }.joinToString("")
            prefs.edit().putString("device_id", deviceId).apply()
        }
        return deviceId
    }

    @JavascriptInterface
    fun setAutoBoot(enabled: Boolean) {
        Log.d("TvBridge", "setAutoBoot: \$enabled")
        prefs.edit().putBoolean("autoBoot", enabled).apply()
    }

    @JavascriptInterface
    fun getAutoBoot(): Boolean {
        return prefs.getBoolean("autoBoot", true) // Default is true for Kiosk
    }

    @JavascriptInterface
    fun setWatchdog(enabled: Boolean) {
        Log.d("TvBridge", "setWatchdog: \$enabled")
        prefs.edit().putBoolean("watchdogEnabled", enabled).apply()
    }
    
    @JavascriptInterface
    fun getWatchdog(): Boolean {
        return prefs.getBoolean("watchdogEnabled", true)
    }

    @JavascriptInterface
    fun setKeepAwake(enabled: Boolean) {
        Log.d("TvBridge", "setKeepAwake: \$enabled")
        prefs.edit().putBoolean("keepAwake", enabled).apply()
        activity.runOnUiThread {
            if (enabled) {
                activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            } else {
                activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
        }
    }
    
    @JavascriptInterface
    fun getKeepAwake(): Boolean {
        return prefs.getBoolean("keepAwake", true)
    }

    @JavascriptInterface
    fun setOrientation(landscape: Boolean) {
        Log.d("TvBridge", "setOrientation landscape: \$landscape")
        prefs.edit().putBoolean("landscape", landscape).apply()
        activity.runOnUiThread {
            activity.requestedOrientation = if (landscape) {
                android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            } else {
                android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT
            }
        }
    }
    
    @JavascriptInterface
    fun getOrientation(): Boolean {
        return prefs.getBoolean("landscape", true)
    }

    @JavascriptInterface
    fun scheduleDailyRestart(hour: Int, minute: Int) {
        Log.d("TvBridge", "scheduleDailyRestart at \$hour:\$minute")
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
        
        Log.d("TvBridge", "Alarm scheduled for \${calendar.time}")
    }
    
    @JavascriptInterface
    fun getRebootHour(): Int {
        return prefs.getInt("rebootHour", 3) // Default 3 AM
    }
    
    @JavascriptInterface
    fun getRebootMinute(): Int {
        return prefs.getInt("rebootMinute", 0)
    }

    @JavascriptInterface
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
    
    @JavascriptInterface
    fun connectToWifi(ssid: String, psk: String): Boolean {
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

    @JavascriptInterface
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
    
    @JavascriptInterface
    fun resetTelemetry() {
        prefs.edit()
            .putInt("bootCount", 0)
            .putInt("crashCount", 0)
            .apply()
    }
}
