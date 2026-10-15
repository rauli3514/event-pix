package com.eventpix.tv.core

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences

import android.net.Uri
import android.content.pm.ApplicationInfo
import android.os.Bundle
import android.os.SystemClock
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import android.widget.TextView
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import android.util.Log
import kotlinx.coroutines.*
import com.eventpix.tv.player.R

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var logoImageView: ImageView
    private lateinit var statusTextView: TextView
    private lateinit var diagnosticPanel: View
    
    private lateinit var webViewManager: WebViewManager
    private lateinit var tvBridge: TvBridge
    private var watchdog: WatchdogService? = null
    
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
        
        webView = findViewById(R.id.webView)
        logoImageView = findViewById(R.id.logoImageView)
        statusTextView = findViewById(R.id.statusTextView)
        diagnosticPanel = findViewById(R.id.diagnosticPanel)
        
        // Depuración remota de la web (chrome://inspect en la PC) solo en APKs de prueba.
        if ((applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        // Puente con la web. Solo expone métodos que exigen el token de sesión,
        // que WebViewManager inyecta únicamente en nuestras páginas.
        tvBridge = TvBridge(this)

        webViewManager = WebViewManager(webView, { tvBridge.tokenInjectionScript() }) {
            runOnUiThread {
                val crashPrefs = getSharedPreferences("TvSettings", Context.MODE_PRIVATE)
                crashPrefs.edit().putInt("crashCount", crashPrefs.getInt("crashCount", 0) + 1).apply()
                // Vuelve a ejecutar onCreate: layout nuevo, WebView nuevo y carga de /tv-boot.
                recreate()
            }
        }
        
        webViewManager.initializeWebView()
        
        // Expose Javascript Interface to React
        webView.addJavascriptInterface(tvBridge, "TvBridge")
        
        // Ensure daily restart is scheduled on boot based on saved settings
        tvBridge.scheduleDailyRestart(tvBridge.getRebootHour(), tvBridge.getRebootMinute())

        // Vigila que el hilo de la UI no quede bloqueado (antes nunca se iniciaba).
        watchdog = WatchdogService(this, webViewManager).also { it.start() }

        setupBackHandling()
        setImmersiveMode()
        startBootSequence()
    }
    
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            setImmersiveMode()
        }
    }
    
    private fun setImmersiveMode() {
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_FULLSCREEN
        )
    }

    // ATRÁS no cierra la app (modo kiosco). 5 veces seguidas abre los Ajustes de
    // Android: es la salida de emergencia que indican las pantallas de la TV.
    // (La web no recibe la tecla ATRÁS: la consume la Activity.)
    private var backPressCount = 0
    private var lastBackPressAt = 0L

    private fun setupBackHandling() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val now = SystemClock.uptimeMillis()
                backPressCount = if (now - lastBackPressAt > 1500) 1 else backPressCount + 1
                lastBackPressAt = now
                if (backPressCount >= 5) {
                    backPressCount = 0
                    Log.d("MainActivity", "5x ATRÁS: abriendo Ajustes de Android")
                    tvBridge.openSettings()
                }
            }
        })
    }
    
    private fun startBootSequence() {
        // Transition to WebView for the actual Display App UI immediately
        diagnosticPanel.visibility = View.GONE
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
        watchdog?.stop()
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
