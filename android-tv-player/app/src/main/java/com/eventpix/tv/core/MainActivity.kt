package com.eventpix.tv.core

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences

import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import android.widget.TextView
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity
import android.util.Log
import kotlinx.coroutines.*
import androidx.media3.ui.PlayerView
import com.eventpix.tv.player.R

class MainActivity : AppCompatActivity() {

    private lateinit var playerView: PlayerView
    private lateinit var webView: WebView
    private lateinit var logoImageView: ImageView
    private lateinit var statusTextView: TextView
    private lateinit var diagnosticPanel: View
    
    private lateinit var playerManager: PlayerManager
    private lateinit var webViewManager: WebViewManager
    
    private val scope = CoroutineScope(Dispatchers.Main + Job())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Setup Uncaught Exception Handler for auto-restart on crash (Watchdog)
        setupCrashHandler()
        
        // Apply saved settings
        val prefs = getSharedPreferences("TvSettings", Context.MODE_PRIVATE)
        if (prefs.getBoolean("keepAwake", true)) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
        val landscape = prefs.getBoolean("landscape", true)
        requestedOrientation = if (landscape) {
            android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        } else {
            android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT
        }
        
        Log.d("MainActivity", "Initializing EventPix TV Player V2...")

        setContentView(R.layout.activity_main)
        
        playerView = findViewById(R.id.playerView)
        webView = findViewById(R.id.webView)
        logoImageView = findViewById(R.id.logoImageView)
        statusTextView = findViewById(R.id.statusTextView)
        diagnosticPanel = findViewById(R.id.diagnosticPanel)
        
        playerManager = PlayerManager(this, playerView)
        webViewManager = WebViewManager(webView)
        
        webViewManager.initializeWebView()
        
        // Expose Javascript Interface to React
        val tvBridge = TvBridge(this)
        webView.addJavascriptInterface(tvBridge, "TvBridge")
        
        // Ensure daily restart is scheduled on boot based on saved settings
        tvBridge.scheduleDailyRestart(tvBridge.getRebootHour(), tvBridge.getRebootMinute())

        startBootSequence()
    }
    
    private fun startBootSequence() {
        // Transition to WebView for the actual Display App UI immediately
        diagnosticPanel.visibility = View.GONE
        playerView.visibility = View.GONE
        logoImageView.visibility = View.GONE
        webView.visibility = View.VISIBLE
        
        // Set WebView background to black to prevent white flash
        webView.setBackgroundColor(android.graphics.Color.BLACK)
        
        // Carga la app
        webViewManager.loadUrl("https://app.event-pix.com.ar/tv-boot")
    }
    
    private fun updateStatus(message: String) {
        statusTextView.text = message
    }
    
    override fun onDestroy() {
        super.onDestroy()
        playerManager.releasePlayer()
        scope.cancel()
    }
    
    private fun setupCrashHandler() {
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, exception ->
            Log.e("MainActivity", "CRITICAL UNCAUGHT EXCEPTION", exception)
            
            val prefs = getSharedPreferences("TvSettings", Context.MODE_PRIVATE)
            val currentCrashCount = prefs.getInt("crashCount", 0)
            prefs.edit().putInt("crashCount", currentCrashCount + 1).apply()
            
            if (prefs.getBoolean("watchdogEnabled", true)) {
                Log.e("MainActivity", "Watchdog enabled. Scheduling emergency restart...")
                val intent = Intent(this@MainActivity, AppRestartReceiver::class.java).apply {
                    putExtra("killProcess", true)
                }
                val pendingIntent = PendingIntent.getBroadcast(
                    this@MainActivity, 
                    99, 
                    intent, 
                    PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
                )
                val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
                alarmManager.set(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 2000, pendingIntent)
            }
            
            defaultHandler?.uncaughtException(thread, exception)
        }
    }
}
