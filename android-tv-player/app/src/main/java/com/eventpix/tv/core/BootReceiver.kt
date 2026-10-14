package com.eventpix.tv.core

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || 
            intent.action == "android.intent.action.QUICKBOOT_POWERON" ||
            intent.action == "android.intent.action.LOCKED_BOOT_COMPLETED") {
            
            Log.d("BootReceiver", "Boot completed detected! Checking autoBoot preference...")
            
            val prefs = context.getSharedPreferences("TvSettings", Context.MODE_PRIVATE)
            val autoBoot = prefs.getBoolean("autoBoot", true)
            
            val currentBootCount = prefs.getInt("bootCount", 0)
            prefs.edit().putInt("bootCount", currentBootCount + 1).apply()
            
            if (autoBoot) {
                Log.d("BootReceiver", "autoBoot is enabled. Starting EventPix TV...")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
                    !android.provider.Settings.canDrawOverlays(context)) {
                    // Android 10+ bloquea abrir la app desde acá sin ese permiso
                    // (salvo que EventPix sea el launcher). Se activa desde el
                    // menú de la TV: "Arranque automático".
                    Log.w("BootReceiver", "Sin permiso 'mostrar sobre otras apps': Android puede bloquear el arranque automático.")
                }
                val launchIntent = Intent(context, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                context.startActivity(launchIntent)
            } else {
                Log.d("BootReceiver", "autoBoot is disabled. Skipping launch.")
            }
        }
    }
}
