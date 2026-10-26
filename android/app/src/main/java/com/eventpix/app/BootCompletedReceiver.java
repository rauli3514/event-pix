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
 *
 * Algunas TV box (Tanix) terminan de cargar su propio inicio después del aviso de
 * encendido y lo ponen encima del kiosco: por eso se insiste unas veces más, solo
 * si el kiosco no está al frente.
 */
public class BootCompletedReceiver extends BroadcastReceiver {
    private static final String TAG = "BootCompletedReceiver";
    /** Momentos (desde el aviso) en que se abre el kiosco si no está al frente */
    private static final long[] ATTEMPTS_MS = {3000, 12000, 25000, 45000};

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
        BootLog.received(app, action);
        final PendingResult pending = goAsync();
        Handler handler = new Handler(Looper.getMainLooper());
        for (int i = 0; i < ATTEMPTS_MS.length; i++) {
            final boolean last = i == ATTEMPTS_MS.length - 1;
            handler.postDelayed(() -> {
                try {
                    if (!MainActivity.isInForeground()) open(app);
                } finally {
                    if (last) pending.finish();
                }
            }, ATTEMPTS_MS[i]);
        }
    }

    private static void open(Context app) {
        try {
            Intent activityIntent = new Intent(app, MainActivity.class);
            activityIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            app.startActivity(activityIntent);
            BootLog.attempt(app, null);
        } catch (Exception e) {
            Log.w(TAG, "No se pudo abrir el kiosco al arrancar", e);
            BootLog.attempt(app, e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }
}
