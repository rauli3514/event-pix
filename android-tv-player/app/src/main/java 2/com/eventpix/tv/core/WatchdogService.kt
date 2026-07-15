package com.eventpix.tv.core

import android.os.Handler
import android.os.Looper
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
    private var lastUiPingTime = System.currentTimeMillis()

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
            lastUiPingTime = System.currentTimeMillis()
        }
    }

    private fun checkHealth() {
        val currentTime = System.currentTimeMillis()
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
        // Fallback strategy for embedded devices
        Log.e("WatchdogService", "Killing process for system recovery.")
        exitProcess(1) // Since BOOT_COMPLETED and sticky services are used, system will restart it
    }
}
