package com.eventpix.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

/**
 * Abre la app sola al prender el equipo (y después de actualizarla), para que el
 * kiosco quede siempre en pantalla aunque se corte la luz.
 *
 * Desde Android 10 una app no puede abrir pantallas desde segundo plano salvo que sea
 * la pantalla de inicio (lanzador) o tenga el permiso "Mostrar sobre otras apps".
 * Por eso en Ajustes → Equipo se pide elegirla como pantalla de inicio (lo más
 * seguro) o dar ese permiso.
 */
public class BootCompletedReceiver extends BroadcastReceiver {
    private static final String TAG = "BootCompletedReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;
        boolean boot = action.equals(Intent.ACTION_BOOT_COMPLETED)
                || action.endsWith(".QUICKBOOT_POWERON")
                || action.equals(Intent.ACTION_MY_PACKAGE_REPLACED);
        if (!boot) return;
        Log.d(TAG, "Arranque recibido (" + action + "), abriendo el kiosco");
        final Context app = context.getApplicationContext();
        final PendingResult pending = goAsync();
        // Unos segundos de margen: algunas TV box todavía están levantando la interfaz
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            try {
                Intent activityIntent = new Intent(app, MainActivity.class);
                activityIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                app.startActivity(activityIntent);
            } catch (Exception e) {
                Log.w(TAG, "No se pudo abrir el kiosco al arrancar", e);
            } finally {
                pending.finish();
            }
        }, 3000);
    }
}
