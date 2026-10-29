package com.eventpix.tv.core

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        // Un error acá (al prender el equipo) no tiene que cerrar la app.
        try {
            handle(context, intent)
        } catch (t: Throwable) {
            Log.e("BootReceiver", "Falló el arranque automático (${intent.action})", t)
        }
    }

    private fun handle(context: Context, intent: Intent) {
        // Android 7+ manda LOCKED_BOOT_COMPLETED antes de desbloquear el
        // almacenamiento: leer los ajustes ahí tira IllegalStateException. Se
        // espera al BOOT_COMPLETED, que llega enseguida.
        if (intent.action == "android.intent.action.LOCKED_BOOT_COMPLETED") {
            Log.d("BootReceiver", "LOCKED_BOOT_COMPLETED: se espera a BOOT_COMPLETED")
            return
        }

        // Después de actualizarse desde la TV, volver a abrir la app.
        if (intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            Log.d("BootReceiver", "App actualizada: reabriendo EventPix TV")
            val relaunch = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            context.startActivity(relaunch)
            return
        }

        if (intent.action == Intent.ACTION_BOOT_COMPLETED || 
            intent.action == "android.intent.action.QUICKBOOT_POWERON") {
            
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
