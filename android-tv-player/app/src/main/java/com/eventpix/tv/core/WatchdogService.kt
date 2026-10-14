package com.eventpix.tv.core

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import kotlinx.coroutines.*
import kotlin.system.exitProcess

class WatchdogService(
    private val mainActivity: MainActivity,
    private val playerManager: PlayerManager,
    private val webViewManager: WebViewManager
) {
    private val scope = CoroutineScope(Dispatchers.Default + Job())
    private var isRunning = false
    private val uiHandler = Handler(Looper.getMainLooper())
    // uptimeMillis no avanza mientras el equipo duerme: evita "detectar" un
    // bloqueo falso al despertar de un reposo largo.
    @Volatile private var lastUiPingTime = SystemClock.uptimeMillis()

    fun start() {
        if (isRunning) return
        isRunning = true
        Log.i("WatchdogService", "Watchdog started. Monitoring system health...")

        // Thread to ping the UI thread
        scope.launch {
            while (isRunning) {
                pingUiThread()
                delay(5000) // check every 5 seconds
                checkHealth()
            }
        }
    }

    fun stop() {
        isRunning = false
        scope.cancel()
    }

    private fun pingUiThread() {
        uiHandler.post {
            lastUiPingTime = SystemClock.uptimeMillis()
        }
    }

    private fun checkHealth() {
        val currentTime = SystemClock.uptimeMillis()
        val timeSinceLastPing = currentTime - lastUiPingTime
        
        Log.d("WatchdogService", "Health check. Time since last UI ping: ${timeSinceLastPing}ms")
        
        // If UI thread hasn't responded in 15 seconds, assume ANR (Application Not Responding)
        if (timeSinceLastPing > 15000) {
            Log.e("WatchdogService", "CRITICAL: UI Thread is blocked! Initiating emergency restart.")
            // In a real kiosk scenario, we might force restart the activity or the process
            forceRestart()
        }
    }
    
    private fun forceRestart() {
        // Matar el proceso no alcanza para que vuelva a abrirse: se agenda la
        // reapertura (igual que el manejador de crashes) y recién después se mata.
        val prefs = mainActivity.getSharedPreferences("TvSettings", Context.MODE_PRIVATE)
        if (!prefs.getBoolean("watchdogEnabled", true)) {
            Log.e("WatchdogService", "UI bloqueada pero el watchdog está desactivado: no se reinicia.")
            return
        }
        prefs.edit().putInt("crashCount", prefs.getInt("crashCount", 0) + 1).commit()

        Log.e("WatchdogService", "Killing process for system recovery.")
        val intent = Intent(mainActivity, AppRestartReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            mainActivity,
            98,
            intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )
        val alarmManager = mainActivity.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.set(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 2000, pendingIntent)
        exitProcess(1)
    }
}
