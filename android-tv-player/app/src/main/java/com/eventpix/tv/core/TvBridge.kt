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
    fun getTelemetry(): String {
        val bootCount = prefs.getInt("bootCount", 0)
        val crashCount = prefs.getInt("crashCount", 0)
        
        val runtime = Runtime.getRuntime()
        val maxMemory = runtime.maxMemory()
        val totalMemory = runtime.totalMemory()
        val freeMemory = runtime.freeMemory()
        val usedMemory = totalMemory - freeMemory
        
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
        
        val json = """
        {
            "boot_count": $bootCount,
            "crash_count": $crashCount,
            "memory": {
                "max_mb": ${maxMemory / 1048576},
                "used_mb": ${usedMemory / 1048576},
                "free_mb": ${freeMemory / 1048576}
            },
            "storage": {
                "total_mb": ${bytesTotal / 1048576},
                "free_mb": ${bytesAvailable / 1048576}
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
