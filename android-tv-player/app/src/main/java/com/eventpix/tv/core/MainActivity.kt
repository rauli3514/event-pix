package com.eventpix.tv.core

import android.content.Context
import android.content.pm.ApplicationInfo
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import android.util.Log
import kotlinx.coroutines.*
import org.json.JSONObject
import java.lang.ref.WeakReference
import com.eventpix.tv.player.R

class MainActivity : AppCompatActivity() {

    companion object {
        // Para avisarle a la web desde receivers (ej. resultado de la actualización).
        private var current: WeakReference<MainActivity>? = null

        fun emitToWebFromAnywhere(event: String, detail: JSONObject) {
            current?.get()?.emitToWeb(event, detail)
        }
    }

    private lateinit var webView: WebView
    private lateinit var logoImageView: ImageView
    private lateinit var statusTextView: TextView
    private lateinit var diagnosticPanel: View
    
    private lateinit var webViewManager: WebViewManager
    private lateinit var tvBridge: TvBridge
    lateinit var appUpdater: AppUpdater
        private set
    private var watchdog: WatchdogService? = null
    
    private val scope = CoroutineScope(Dispatchers.Main + Job())

    private val uiHandler = Handler(Looper.getMainLooper())
    private val markStableRunnable = Runnable { CrashReporter.markStable(this) }

    // Logo de arranque nativo: se ve desde el primer segundo (antes, negro) hasta
    // que la web avisa que se dibujó (TvBridge.pageReady) o se muestra la pantalla
    // de "Sin conexión". Mientras se ve, OK abre los ajustes de Wi-Fi.
    private var bootOverlayVisible = false
    private var webReady = false
    // Si a los 25 s la página no apareció (conexión colgada, Wi-Fi sin internet),
    // se pasa a la pantalla de "Sin conexión", que tiene el botón de Wi-Fi y reintenta.
    private val bootTimeoutRunnable = Runnable {
        if (!webReady && ::webViewManager.isInitialized) {
            Log.w("MainActivity", "La página no apareció en 25 s: pantalla de Sin conexión")
            webViewManager.loadOfflinePage()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Registro de errores: guarda el motivo de cada cierre y corta el loop
        // de reaperturas si la app falla al arrancar (ver CrashReporter).
        CrashReporter.install(this)
        val startup = CrashReporter.onLaunch(this)
        
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

        // Puente con la web. Solo expone métodos que exigen el token de sesión,
        // que WebViewManager inyecta únicamente en nuestras páginas.
        appUpdater = AppUpdater(this) { state, extra -> emitToWeb("tvupdate", extra.put("state", state)) }
        tvBridge = TvBridge(this)
        current = WeakReference(this)
        setupBackHandling()

        if (startup.inLoop) {
            Log.e("MainActivity", "La app se cerró ${startup.quickDeaths} veces al arrancar: pantalla de diagnóstico")
            showDiagnosticScreen(
                "EventPix TV se cerró al arrancar ${startup.quickDeaths} veces seguidas",
                startup.reason
            )
            return
        }
        
        Log.d("MainActivity", "Initializing EventPix TV Player V2...")

        // Contenido guardado en el equipo para reproducir sin internet.
        try {
            MediaCache.init(applicationContext)
        } catch (t: Throwable) {
            Log.e("MainActivity", "No se pudo iniciar la caché de medios", t)
        }

        // Si el WebView del equipo falta, está desactivado o falla al crearse,
        // se muestra el motivo en vez de cerrarse.
        try {
            setupWebView()
        } catch (t: Throwable) {
            Log.e("MainActivity", "No se pudo crear el WebView", t)
            showDiagnosticScreen(
                "No se pudo abrir el navegador interno (WebView) de este equipo",
                "${t.javaClass.name}: ${t.message}\n\n" +
                    "Revisá en Ajustes → Apps que \"Android System WebView\" (o Chrome) esté " +
                    "instalado, activado y actualizado."
            )
            return
        }

        // Ensure daily restart is scheduled on boot based on saved settings
        try {
            tvBridge.scheduleDailyRestart(tvBridge.getRebootHour(), tvBridge.getRebootMinute())
        } catch (t: Throwable) {
            Log.e("MainActivity", "No se pudo programar el reinicio diario", t)
        }

        // Vigila que el hilo de la UI no quede bloqueado (antes nunca se iniciaba).
        watchdog = WatchdogService(this, webViewManager).also { it.start() }

        setImmersiveMode()
        startBootSequence()

        // Al minuto abierta, la app se considera estable.
        uiHandler.postDelayed(markStableRunnable, 60_000)
    }

    private fun setupWebView() {
        setContentView(R.layout.activity_main)
        
        webView = findViewById(R.id.webView)
        logoImageView = findViewById(R.id.logoImageView)
        statusTextView = findViewById(R.id.statusTextView)
        diagnosticPanel = findViewById(R.id.diagnosticPanel)
        
        // Depuración remota de la web (chrome://inspect en la PC) solo en APKs de prueba.
        if ((applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        webViewManager = WebViewManager(
            webView,
            { tvBridge.tokenInjectionScript() },
            {
                runOnUiThread {
                    val crashPrefs = getSharedPreferences("TvSettings", Context.MODE_PRIVATE)
                    crashPrefs.edit().putInt("crashCount", crashPrefs.getInt("crashCount", 0) + 1).apply()
                    // Vuelve a ejecutar onCreate: layout nuevo, WebView nuevo y carga de /tv-boot.
                    recreate()
                }
            },
            { url ->
                // La pantalla de "Sin conexión" del APK ya es una pantalla: sale el logo.
                if (url?.startsWith("file:///android_asset/") == true) runOnUiThread { hideBootOverlay() }
            }
        )
        
        webViewManager.initializeWebView()
        
        // Expose Javascript Interface to React
        webView.addJavascriptInterface(tvBridge, "TvBridge")
    }

    // Pantalla nativa (sin WebView) con el motivo del cierre, para sacarle una
    // foto. Se arma por código: tiene que funcionar aunque falle el layout o el WebView.
    private fun showDiagnosticScreen(title: String, reason: String?) {
        val density = resources.displayMetrics.density
        fun dp(v: Int) = (v * density).toInt()

        val details = TextView(this).apply {
            text = (reason ?: "Sin detalle del error.").lineSequence().take(18).joinToString("\n") +
                "\n\n" + CrashReporter.deviceSummary(this@MainActivity)
            setTextColor(0xFFCBD5E1.toInt())
            textSize = 12f
            typeface = Typeface.MONOSPACE
        }
        val retry = Button(this).apply {
            text = "Reintentar"
            setOnClickListener {
                CrashReporter.resetLoop(this@MainActivity)
                recreate()
            }
        }
        val settings = Button(this).apply {
            text = "Ajustes de Android"
            setOnClickListener { tvBridge.openSettings() }
        }
        val buttons = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            addView(retry)
            addView(settings, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { leftMargin = dp(16) })
        }
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(48), dp(32), dp(48), dp(32))
            addView(TextView(this@MainActivity).apply {
                text = title
                setTextColor(Color.WHITE)
                textSize = 22f
                setTypeface(typeface, Typeface.BOLD)
            })
            addView(TextView(this@MainActivity).apply {
                text = "Sacale una foto a esta pantalla y mandásela a soporte de EventPix. " +
                    "Se vuelve a intentar sola en 5 minutos."
                setTextColor(0xFF94A3B8.toInt())
                textSize = 14f
                setPadding(0, dp(8), 0, dp(16))
            })
            addView(details)
            addView(buttons, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = dp(24) })
        }
        val root = ScrollView(this).apply {
            setBackgroundColor(0xFF020617.toInt())
            addView(content)
        }
        setContentView(root)
        retry.requestFocus()

        // En el local de un cliente no puede quedar esta pantalla para siempre:
        // a los 5 minutos se reintenta sola (por si fue algo pasajero).
        uiHandler.postDelayed({
            CrashReporter.resetLoop(this@MainActivity)
            recreate()
        }, 5 * 60_000)
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
        webView.visibility = View.VISIBLE
        // Fondo negro (sin destello blanco) y, encima, el logo hasta que la web se dibuje.
        webView.setBackgroundColor(android.graphics.Color.BLACK)
        showBootOverlay()

        // Sin red al arrancar (equipo nuevo o Wi-Fi todavía conectando): directo a
        // la pantalla de "Sin conexión", con el botón de Wi-Fi y reintento automático.
        if (!webViewManager.isOnlineNow()) {
            webViewManager.loadOfflinePage()
            return
        }
        webViewManager.loadUrl("https://app.event-pix.com.ar/tv-boot")
        uiHandler.postDelayed(bootTimeoutRunnable, 25_000)
    }

    private fun showBootOverlay() {
        bootOverlayVisible = true
        logoImageView.visibility = View.VISIBLE
        diagnosticPanel.visibility = View.VISIBLE
        updateStatus("Conectando…")
        findViewById<TextView>(R.id.versionTextView)?.text =
            "¿No carga? Presioná OK para configurar el Wi-Fi"
    }

    private fun hideBootOverlay() {
        if (!bootOverlayVisible) return
        bootOverlayVisible = false
        logoImageView.visibility = View.GONE
        diagnosticPanel.visibility = View.GONE
    }

    // La web ya se dibujó (TvBridge.pageReady).
    fun onWebReady() {
        webReady = true
        uiHandler.removeCallbacks(bootTimeoutRunnable)
        hideBootOverlay()
    }

    // Con el logo de arranque en pantalla, OK abre los ajustes de Wi-Fi (si la
    // página no carga, siempre hay forma de configurar la red).
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (bootOverlayVisible && (event.keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
                event.keyCode == KeyEvent.KEYCODE_ENTER || event.keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER)) {
            if (event.action == KeyEvent.ACTION_UP) tvBridge.openWifiSettings()
            return true
        }
        return super.dispatchKeyEvent(event)
    }

    private fun updateStatus(message: String) {
        statusTextView.text = message
    }
    
    // Dispara un CustomEvent en la página, solo si es nuestra (igual que el token del puente).
    fun emitToWeb(event: String, detail: JSONObject) {
        runOnUiThread {
            try {
                if (::webView.isInitialized && WebViewManager.isTrustedUrl(webView.url)) {
                    webView.evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent(${JSONObject.quote(event)},{detail:$detail}));",
                        null
                    )
                }
            } catch (e: Exception) {
                Log.w("MainActivity", "No se pudo avisar a la web ($event)", e)
            }
        }
    }

    override fun onStart() {
        super.onStart()
        CrashReporter.markForeground(this, true)
    }

    // Salir con HOME o abrir otra app no es un cierre inesperado.
    override fun onStop() {
        CrashReporter.markForeground(this, false)
        super.onStop()
    }

    override fun onDestroy() {
        uiHandler.removeCallbacksAndMessages(null)
        if (current?.get() === this) current = null
        super.onDestroy()
        watchdog?.stop()
        scope.cancel()
    }
}
