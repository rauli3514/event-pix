package com.eventpix.tv.core

import android.os.Bundle
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import android.util.Log

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Mantener la pantalla encendida siempre (24/7 rule)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        
        Log.d("MainActivity", "Initializing EventPix TV Player V2...")

        // TODO: Inflar layout
        // setContentView(R.layout.activity_main)
        
        // TODO: Inicializar Watchdog y Diagnóstico
    }
}
