package com.eventpix.app.update;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.util.Log;

import com.eventpix.app.MainActivity;

import org.json.JSONObject;

/** Resultado de la sesión de PackageInstaller que abre KioskUpdater. */
public class UpdateStatusReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        try {
            if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                // Android pide confirmar: se abre su cartel "¿Actualizar esta app?" (la primera
                // vez puede pedir además permitir instalar apps desde EventPix Kiosco)
                @SuppressWarnings("deprecation")
                Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
                if (confirm != null) {
                    confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(confirm);
                }
                MainActivity.emitToPage("kioskupdate", new JSONObject().put("state", "confirm"));
            } else if (status == PackageInstaller.STATUS_SUCCESS) {
                // Android reemplaza este proceso; BootCompletedReceiver (MY_PACKAGE_REPLACED) reabre la app
                Log.i("UpdateStatusReceiver", "Actualización instalada");
            } else {
                String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
                MainActivity.emitToPage("kioskupdate", new JSONObject().put("state", "error")
                        .put("message", message != null ? message : "Instalación cancelada o fallida (" + status + ")"));
            }
        } catch (Exception e) {
            Log.w("UpdateStatusReceiver", "No se pudo avisar a la página", e);
        }
    }
}
