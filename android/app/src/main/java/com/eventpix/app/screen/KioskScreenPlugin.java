package com.eventpix.app.screen;

import android.content.Context;
import android.content.SharedPreferences;
import android.view.View;
import android.view.ViewGroup;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Pantalla girada: la TV box siempre manda la imagen apaisada, así que cuando la
 * tele está colgada en vertical se gira el WebView entero (0/90/180/270°). Al
 * girar la vista, Android también transforma los toques, y la página ve una
 * ventana vertical (vh/vw correctos). Se guarda para aplicarlo al abrir la app.
 */
@CapacitorPlugin(name = "KioskScreen")
public class KioskScreenPlugin extends Plugin {

    private static final String PREFS = "kiosk_screen";
    private static final String KEY_ROTATION = "rotation";

    @PluginMethod
    public void setRotation(PluginCall call) {
        int degrees = normalize(call.getInt("degrees", 0));
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putInt(KEY_ROTATION, degrees).apply();
        getBridge().executeOnMainThread(() -> {
            apply(getBridge().getWebView(), degrees);
            JSObject ret = new JSObject();
            ret.put("degrees", degrees);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void getRotation(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("degrees", savedRotation(getContext()));
        call.resolve(ret);
    }

    public static int savedRotation(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return normalize(prefs.getInt(KEY_ROTATION, 0));
    }

    private static int normalize(int degrees) {
        int d = ((degrees % 360) + 360) % 360;
        return d == 90 || d == 180 || d == 270 ? d : 0;
    }

    /** Gira la vista dentro de su contenedor; se vuelve a aplicar si el contenedor cambia de tamaño. */
    public static void apply(View view, int degrees) {
        if (view == null || !(view.getParent() instanceof View)) return;
        View parent = (View) view.getParent();
        view.setTag(com.eventpix.app.R.id.kiosk_rotation_tag, degrees);
        if (parent.getTag(com.eventpix.app.R.id.kiosk_rotation_tag) == null) {
            parent.setTag(com.eventpix.app.R.id.kiosk_rotation_tag, Boolean.TRUE);
            parent.addOnLayoutChangeListener((v, l, t, r, b, ol, ot, or, ob) -> {
                if (r - l != or - ol || b - t != ob - ot) {
                    Object tag = view.getTag(com.eventpix.app.R.id.kiosk_rotation_tag);
                    v.post(() -> layout(view, (View) v, tag instanceof Integer ? (Integer) tag : 0));
                }
            });
        }
        if (parent.getWidth() == 0 || parent.getHeight() == 0) {
            parent.post(() -> layout(view, parent, degrees));
        } else {
            layout(view, parent, degrees);
        }
    }

    private static void layout(View view, View parent, int degrees) {
        int w = parent.getWidth();
        int h = parent.getHeight();
        if (w == 0 || h == 0) return;
        boolean sideways = degrees == 90 || degrees == 270;
        ViewGroup.LayoutParams lp = view.getLayoutParams();
        lp.width = sideways ? h : ViewGroup.LayoutParams.MATCH_PARENT;
        lp.height = sideways ? w : ViewGroup.LayoutParams.MATCH_PARENT;
        view.setLayoutParams(lp);
        // El centro de la vista girada queda en el centro de la pantalla
        view.setTranslationX(sideways ? (w - h) / 2f : 0f);
        view.setTranslationY(sideways ? (h - w) / 2f : 0f);
        view.setPivotX((sideways ? h : w) / 2f);
        view.setPivotY((sideways ? w : h) / 2f);
        view.setRotation(degrees);
    }
}
