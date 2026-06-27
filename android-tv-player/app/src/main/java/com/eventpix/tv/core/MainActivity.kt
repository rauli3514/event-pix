package com.eventpix.tv.core

import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import android.widget.TextView
import android.widget.VideoView
import androidx.appcompat.app.AppCompatActivity
import android.util.Log
import kotlinx.coroutines.*

class MainActivity : AppCompatActivity() {

    private lateinit var splashVideoView: VideoView
    private lateinit var logoImageView: ImageView
    private lateinit var statusTextView: TextView
    private lateinit var diagnosticPanel: View
    
    private val scope = CoroutineScope(Dispatchers.Main + Job())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Mantener la pantalla encendida siempre (24/7 rule)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        
        Log.d("MainActivity", "Initializing EventPix TV Player V2...")

        setContentView(R.layout.activity_main)
        
        splashVideoView = findViewById(R.id.splashVideoView)
        logoImageView = findViewById(R.id.logoImageView)
        statusTextView = findViewById(R.id.statusTextView)
        diagnosticPanel = findViewById(R.id.diagnosticPanel)

        startBootSequence()
    }
    
    private fun startBootSequence() {
        // Try playing boot animation
        val videoUri = Uri.parse("android.resource://$packageName/${R.raw.boot_animation}")
        splashVideoView.setVideoURI(videoUri)
        splashVideoView.setOnPreparedListener {
            splashVideoView.visibility = View.VISIBLE
            logoImageView.visibility = View.GONE
            it.start()
        }
        
        // Run diagnostic checks in background while video plays
        scope.launch {
            updateStatus("Verificando almacenamiento local...")
            delay(1500) // Simulating work
            
            updateStatus("Inicializando motor multimedia...")
            delay(1500)
            
            updateStatus("Sistema listo.")
            delay(1000)
            
            // TODO: Transition to ExoPlayer / Main App Logic
            diagnosticPanel.visibility = View.GONE
        }
    }
    
    private fun updateStatus(message: String) {
        statusTextView.text = message
    }
    
    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }
}
