package com.eventpix.app.print;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Calendar;

/**
 * Trabajo de impresión en ESC/P-R, el idioma de las Epson de tinta (las que no tienen
 * IPP por USB, como la L1250). Es lo que manda el driver de Epson para Linux: entra en
 * modo "remoto" para avisar que empieza un trabajo, pasa a modo ESC/P-R, configura papel
 * y calidad, y manda la foto línea por línea en RGB.
 *
 * Referencia de los comandos: python-epson (MIT, J. McMullan) y el driver ESC/P-R de
 * Epson. Las líneas van sin comprimir: por cable alcanza y no hay riesgo de un
 * compresor que la impresora entienda distinto.
 */
final class EscprEncoder {

    private EscprEncoder() {}

    /** Las líneas de la página en ARGB (como Bitmap.getPixels). */
    interface RowSource {
        void getRow(int y, int[] out);
    }

    /** Resolución con la que se manda la foto (la de las Epson; 720 no suma nada con una foto de 1800 px) */
    static final int DPI = 360;

    // Tipo de papel (MTID)
    static final int MEDIA_PLAIN = 0;
    static final int MEDIA_MATTE = 5;
    static final int MEDIA_PREMIUM_GLOSSY = 11;

    private static final int QUALITY_HIGH = 2;

    static final class Job {
        /** Papel en centésimas de mm */
        int paperWidthHmm;
        int paperHeightHmm;
        int mediaType = MEDIA_PREMIUM_GLOSSY;
        boolean borderless;
        int copies = 1;
        String name = "EventPix";
    }

    /** Puntos a DPI de una medida en centésimas de mm (como el driver: hacia arriba). */
    static int dots(int hmm) {
        return (int) Math.ceil(hmm / 2540.0 * DPI);
    }

    /** Margen de la impresora con bordes: 3 mm */
    static int marginDots(Job job) {
        return job.borderless ? 0 : (int) Math.floor(3 / 25.4 * DPI);
    }

    /**
     * Escribe el trabajo completo. La página (rows) tiene que ser del tamaño del papel a
     * 360 dpi (dots(ancho) × dots(alto)); con bordes se manda la parte de adentro del margen.
     */
    static void write(OutputStream out, Job job, RowSource rows) throws IOException {
        int paperW = dots(job.paperWidthHmm);
        int paperH = dots(job.paperHeightHmm);
        int margin = marginDots(job);
        int areaW = paperW - 2 * margin;
        int areaH = paperH - 2 * margin;

        // Sale del modo paquetes (IEEE 1284.4) y reinicia
        out.write(new byte[]{0x00, 0x00, 0x00, 0x1B, 0x01});
        out.write(ascii("@EJL 1284.4\n@EJL     \n"));
        out.write(new byte[]{0x1B, '@'});

        // Modo remoto: hora, comienzo de trabajo, origen y bandeja de papel
        enterRemote(out);
        Calendar now = Calendar.getInstance();
        int year = now.get(Calendar.YEAR);
        remote(out, "TI", new byte[]{(byte) (year >> 8), (byte) year, (byte) (now.get(Calendar.MONTH) + 1),
                (byte) now.get(Calendar.DAY_OF_MONTH), (byte) now.get(Calendar.HOUR_OF_DAY),
                (byte) now.get(Calendar.MINUTE), (byte) now.get(Calendar.SECOND)});
        remote(out, "JS", new byte[]{0, 0, 0});
        byte[] name = ascii(job.name.length() > 32 ? job.name.substring(0, 32) : job.name);
        byte[] header = new byte[5 + name.length];
        System.arraycopy(name, 0, header, 5, name.length);
        remote(out, "JH", header);
        remote(out, "HD", new byte[]{3, 4});
        remote(out, "PP", new byte[]{1, 0}); // bandeja de atrás (la única en las L)
        exitRemote(out);

        // Modo ESC/P-R
        out.write(new byte[]{0x1B, '(', 'R', 0x06, 0x00, 0x00});
        out.write(ascii("ESCPR"));

        // Calidad: tipo de papel, alta, color, sin ajustes, RGB de 24 bits, sin paleta
        command(out, 'q', "setq", new byte[]{(byte) job.mediaType, QUALITY_HIGH, 0, 0, 0, 0, 0, 0, 0});

        // Trabajo: papel, márgenes, zona imprimible, 360 dpi, en los dos sentidos
        byte[] setj = new byte[22];
        putInt(setj, 0, paperW);
        putInt(setj, 4, paperH);
        putShort(setj, 8, margin);
        putShort(setj, 10, margin);
        putInt(setj, 12, areaW);
        putInt(setj, 16, areaH);
        setj[20] = 0; // 360 dpi
        setj[21] = 0; // bidireccional
        command(out, 'j', "setj", setj);

        int[] argb = new int[paperW];
        byte[] line = new byte[7 + areaW * 3];
        int copies = Math.max(1, Math.min(99, job.copies));
        for (int copy = 0; copy < copies; copy++) {
            command(out, 'p', "sttp", new byte[0]);
            for (int y = 0; y < areaH; y++) {
                rows.getRow(margin + y, argb);
                putShort(line, 0, 0);
                putShort(line, 2, y);
                line[4] = 0; // sin comprimir
                putShort(line, 5, areaW * 3);
                for (int x = 0, o = 7; x < areaW; x++) {
                    int c = argb[margin + x];
                    line[o++] = (byte) (c >> 16);
                    line[o++] = (byte) (c >> 8);
                    line[o++] = (byte) c;
                }
                command(out, 'd', "dsnd", line);
            }
            // Cuántas páginas faltan
            command(out, 'p', "endp", new byte[]{(byte) (copies - copy - 1)});
        }
        command(out, 'j', "endj", new byte[0]);

        // Fin: reinicia, valores de fábrica y fin de trabajo
        out.write(new byte[]{0x1B, '@'});
        enterRemote(out);
        remote(out, "LD", new byte[0]);
        remote(out, "JE", new byte[0]);
        exitRemote(out);
        out.flush();
    }

    private static void enterRemote(OutputStream out) throws IOException {
        out.write(new byte[]{0x1B, '(', 'R', 0x08, 0x00, 0x00});
        out.write(ascii("REMOTE1"));
    }

    private static void exitRemote(OutputStream out) throws IOException {
        out.write(new byte[]{0x1B, 0x00, 0x00, 0x00});
    }

    /** Comando remoto: nombre, largo (LE, datos + 1), byte de respuesta 0, datos. */
    private static void remote(OutputStream out, String cmd, byte[] data) throws IOException {
        int len = data.length + 1;
        out.write(ascii(cmd));
        out.write(new byte[]{(byte) len, (byte) (len >> 8), 0});
        out.write(data);
    }

    /** Comando ESC/P-R: ESC, clase, largo de los datos (LE, 4 bytes), nombre, datos. */
    private static void command(OutputStream out, char cls, String code, byte[] data) throws IOException {
        int len = data.length;
        out.write(new byte[]{0x1B, (byte) cls, (byte) len, (byte) (len >> 8), (byte) (len >> 16), (byte) (len >> 24)});
        out.write(ascii(code));
        out.write(data);
    }

    private static void putInt(byte[] b, int i, int v) {
        b[i] = (byte) (v >> 24);
        b[i + 1] = (byte) (v >> 16);
        b[i + 2] = (byte) (v >> 8);
        b[i + 3] = (byte) v;
    }

    private static void putShort(byte[] b, int i, int v) {
        b[i] = (byte) (v >> 8);
        b[i + 1] = (byte) v;
    }

    private static byte[] ascii(String s) {
        return s.getBytes(java.nio.charset.StandardCharsets.US_ASCII);
    }
}
