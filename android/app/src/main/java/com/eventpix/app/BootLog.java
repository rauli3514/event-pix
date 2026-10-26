package com.eventpix.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.SystemClock;
import android.provider.Settings;

import org.json.JSONObject;

/**
 * Registro del último encendido, para Ajustes → Equipo → Diagnóstico: si Android avisó a
 * la app que el equipo prendió, cuántas veces se intentó abrir el kiosco y si se abrió.
 * Así se sabe si el problema es que el aviso no llega o que Android no deja abrirla.
 */
final class BootLog {
    private static final String PREFS = "eventpix_boot";

    private BootLog() {}

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static int bootCount(Context c) {
        return Settings.Global.getInt(c.getContentResolver(), Settings.Global.BOOT_COUNT, -1);
    }

    /** Llegó el aviso de encendido (o de actualización). */
    static void received(Context c, String action) {
        prefs(c).edit()
                .putInt("boot", bootCount(c))
                .putString("action", action)
                .putLong("receivedAt", SystemClock.elapsedRealtime())
                .putInt("attempts", 0)
                .putLong("openedAt", -1)
                .putString("error", "")
                .apply();
    }

    static void attempt(Context c, String error) {
        SharedPreferences p = prefs(c);
        SharedPreferences.Editor e = p.edit().putInt("attempts", p.getInt("attempts", 0) + 1);
        if (error != null) e.putString("error", error);
        e.apply();
    }

    /** La pantalla del kiosco quedó al frente (se llama en cada onResume). */
    static void opened(Context c) {
        SharedPreferences p = prefs(c);
        if (p.getInt("boot", -2) == bootCount(c) && p.getLong("openedAt", -1) < 0) {
            p.edit().putLong("openedAt", SystemClock.elapsedRealtime()).apply();
        }
    }

    static JSONObject toJson(Context c) throws Exception {
        SharedPreferences p = prefs(c);
        return new JSONObject()
                .put("thisBoot", p.getInt("boot", -2) == bootCount(c))
                .put("action", p.getString("action", ""))
                .put("receivedAtMs", p.getLong("receivedAt", -1))
                .put("attempts", p.getInt("attempts", 0))
                .put("openedAtMs", p.getLong("openedAt", -1))
                .put("error", p.getString("error", ""));
    }
}
