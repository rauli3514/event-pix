package com.eventpix.tv.core

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import android.util.Log
import org.json.JSONObject

// Resultado de la sesión de PackageInstaller que abre AppUpdater.
class UpdateStatusReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
            // Android pide confirmar: se abre su diálogo para aceptar con el control remoto
            // (la primera vez puede pedir además permitir instalar desde esta app).
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                val confirm: Intent? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableExtra(Intent.EXTRA_INTENT)
                }
                if (confirm != null) {
                    confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(confirm)
                }
                MainActivity.emitToWebFromAnywhere("tvupdate", JSONObject().put("state", "confirm"))
            }
            // Al instalarse, Android reemplaza este proceso; BootReceiver
            // (MY_PACKAGE_REPLACED) vuelve a abrir la app.
            PackageInstaller.STATUS_SUCCESS -> Log.i("UpdateStatusReceiver", "Actualización instalada")
            else -> {
                val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: "Instalación cancelada o fallida ($status)"
                Log.w("UpdateStatusReceiver", "Actualización no instalada: $message")
                MainActivity.emitToWebFromAnywhere(
                    "tvupdate",
                    JSONObject().put("state", "error").put("message", message)
                )
            }
        }
    }
}
