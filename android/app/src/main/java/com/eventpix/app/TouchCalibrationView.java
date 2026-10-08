package com.eventpix.app;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.view.MotionEvent;
import android.view.View;

/**
 * Calibración del marco táctil: muestra una cruz en cada esquina, toma dónde llega el
 * toque en cada una y calcula la corrección (estirado, corrimiento, giro) que lleva los
 * toques al lugar real. Las cruces se dibujan en la pantalla de Android, así que sirve
 * con la tele girada; el texto se gira igual que la app.
 */
@SuppressLint("ViewConstructor")
public class TouchCalibrationView extends View {

    public interface Listener {
        /** Corrección calculada (null si se canceló o salió mal) */
        void onDone(Matrix correction);
    }

    /** Dónde van las cruces: proporción del ancho y alto de la pantalla */
    private static final float[][] TARGETS = {{0.12f, 0.12f}, {0.88f, 0.12f}, {0.88f, 0.88f}, {0.12f, 0.88f}};

    private final Listener listener;
    private final float textRotation;
    private final float[][] touched = new float[TARGETS.length][2];
    private int index = 0;
    private final Paint cross = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint ring = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);

    public TouchCalibrationView(Context context, float textRotation, Listener listener) {
        super(context);
        this.listener = listener;
        this.textRotation = textRotation;
        setBackgroundColor(Color.rgb(7, 5, 26));
        cross.setColor(Color.WHITE);
        cross.setStrokeWidth(6f);
        ring.setColor(Color.rgb(255, 46, 147));
        ring.setStyle(Paint.Style.STROKE);
        ring.setStrokeWidth(8f);
        text.setColor(Color.WHITE);
        text.setTextAlign(Paint.Align.CENTER);
        setClickable(true);
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        int w = getWidth();
        int h = getHeight();
        float unit = Math.min(w, h);
        if (index < TARGETS.length) {
            float x = TARGETS[index][0] * w;
            float y = TARGETS[index][1] * h;
            float arm = unit * 0.05f;
            canvas.drawLine(x - arm, y, x + arm, y, cross);
            canvas.drawLine(x, y - arm, x, y + arm, cross);
            canvas.drawCircle(x, y, arm * 0.7f, ring);
        }
        canvas.save();
        canvas.rotate(textRotation, w / 2f, h / 2f);
        text.setTextSize(unit * 0.045f);
        canvas.drawText("Calibrar pantalla táctil", w / 2f, h / 2f - unit * 0.04f, text);
        text.setTextSize(unit * 0.032f);
        canvas.drawText("Tocá el centro de la cruz (" + Math.min(index + 1, TARGETS.length) + " de " + TARGETS.length + ")",
                w / 2f, h / 2f + unit * 0.03f, text);
        canvas.restore();
    }

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        if (event.getActionMasked() != MotionEvent.ACTION_DOWN || index >= TARGETS.length) return true;
        // Donde lo apoyó (el punto al levantar suele venir corrido en estos marcos)
        touched[index][0] = event.getX();
        touched[index][1] = event.getY();
        index++;
        if (index < TARGETS.length) {
            invalidate();
            return true;
        }
        float[][] real = new float[TARGETS.length][2];
        for (int i = 0; i < TARGETS.length; i++) {
            real[i][0] = TARGETS[i][0] * getWidth();
            real[i][1] = TARGETS[i][1] * getHeight();
        }
        listener.onDone(solve(touched, real, Math.min(getWidth(), getHeight())));
        return true;
    }

    /**
     * Corrección afín (x' = a·x + b·y + c; y' = d·x + e·y + f) por mínimos cuadrados.
     * Si sale algo absurdo (toques mal hechos) devuelve null.
     */
    static Matrix solve(float[][] from, float[][] to, float size) {
        double[][] ata = new double[3][3];
        double[] atx = new double[3];
        double[] aty = new double[3];
        for (int i = 0; i < from.length; i++) {
            double[] row = {from[i][0], from[i][1], 1};
            for (int r = 0; r < 3; r++) {
                for (int c = 0; c < 3; c++) ata[r][c] += row[r] * row[c];
                atx[r] += row[r] * to[i][0];
                aty[r] += row[r] * to[i][1];
            }
        }
        double[] px = solve3(ata, atx);
        double[] py = solve3(ata, aty);
        if (px == null || py == null) return null;
        // Estirado razonable (entre la mitad y el doble) y corrimiento dentro de la pantalla
        double sx = Math.hypot(px[0], py[0]);
        double sy = Math.hypot(px[1], py[1]);
        if (sx < 0.5 || sx > 2 || sy < 0.5 || sy > 2) return null;
        if (Math.abs(px[2]) > size * 2 || Math.abs(py[2]) > size * 2) return null;
        Matrix m = new Matrix();
        m.setValues(new float[]{(float) px[0], (float) px[1], (float) px[2], (float) py[0], (float) py[1], (float) py[2], 0, 0, 1});
        return m;
    }

    private static double[] solve3(double[][] a, double[] b) {
        double det = det3(a);
        if (Math.abs(det) < 1e-9) return null;
        double[] out = new double[3];
        for (int col = 0; col < 3; col++) {
            double[][] m = {a[0].clone(), a[1].clone(), a[2].clone()};
            for (int r = 0; r < 3; r++) m[r][col] = b[r];
            out[col] = det3(m) / det;
        }
        return out;
    }

    private static double det3(double[][] m) {
        return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
                - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
                + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    }
}
