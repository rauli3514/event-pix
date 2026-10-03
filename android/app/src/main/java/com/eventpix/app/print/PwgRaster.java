package com.eventpix.app.print;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;

/**
 * Codifica una página en PWG Raster (PWG 5102.4), el formato que piden las
 * impresoras IPP Everywhere que no aceptan JPEG ni PDF (p. ej. Epson L1250).
 * Java puro: las filas llegan como ARGB, así se puede probar fuera de Android.
 */
public final class PwgRaster {

    private static final int HEADER_SIZE = 1796;
    private static final int CSPACE_SGRAY = 18;
    private static final int CSPACE_SRGB = 19;
    private static final int MAX_RUN = 128;

    private PwgRaster() {}

    /** Entrega una fila de la página en ARGB (como Bitmap.getPixels). */
    public interface RowSource {
        void getRow(int y, int[] out);
    }

    public static final class Page {
        public int widthPx;
        public int heightPx;
        public int dpi = 300;
        /** true = sRGB 8 bits por canal; false = gris 8 bits. */
        public boolean color = true;
        /** Keyword PWG del papel, p. ej. "na_index-4x6_4x6in". */
        public String pageSizeName = "";
        public String mediaType = "";
        /** 3 = borrador, 4 = normal, 5 = alta. */
        public int printQuality = 5;
    }

    public static byte[] encode(Page page, RowSource rows) throws IOException {
        int bpp = page.color ? 3 : 1;
        ByteArrayOutputStream out = new ByteArrayOutputStream(page.widthPx * page.heightPx * bpp / 4);
        out.write("RaS2".getBytes(StandardCharsets.US_ASCII));
        out.write(header(page));
        writePixels(out, page, rows);
        return out.toByteArray();
    }

    static byte[] header(Page p) {
        ByteBuffer h = ByteBuffer.allocate(HEADER_SIZE); // big-endian por defecto
        putString(h, 0, "PwgRaster");
        putString(h, 128, p.mediaType);
        h.putInt(276, p.dpi);                 // HWResolution[0]
        h.putInt(280, p.dpi);                 // HWResolution[1]
        h.putInt(340, 1);                     // NumCopies (las copias van por IPP)
        h.putInt(352, Math.round(p.widthPx * 72f / p.dpi));  // PageSize en puntos
        h.putInt(356, Math.round(p.heightPx * 72f / p.dpi));
        h.putInt(372, p.widthPx);             // Width
        h.putInt(376, p.heightPx);            // Height
        h.putInt(384, 8);                     // BitsPerColor
        h.putInt(388, p.color ? 24 : 8);      // BitsPerPixel
        h.putInt(392, p.widthPx * (p.color ? 3 : 1)); // BytesPerLine
        h.putInt(396, 0);                     // ColorOrder: chunky
        h.putInt(400, p.color ? CSPACE_SRGB : CSPACE_SGRAY);
        h.putInt(420, p.color ? 3 : 1);       // NumColors
        h.putInt(452, 1);                     // TotalPageCount
        h.putInt(456, 1);                     // CrossFeedTransform
        h.putInt(460, 1);                     // FeedTransform
        h.putInt(472, p.widthPx);             // ImageBoxRight
        h.putInt(476, p.heightPx);            // ImageBoxBottom
        h.putInt(480, 0x00FFFFFF);            // AlternatePrimary
        h.putInt(484, p.printQuality);
        putString(h, 1732, p.pageSizeName);
        return h.array();
    }

    private static void putString(ByteBuffer h, int offset, String value) {
        if (value == null) return;
        byte[] b = value.getBytes(StandardCharsets.US_ASCII);
        for (int i = 0; i < Math.min(b.length, 63); i++) h.put(offset + i, b[i]);
    }

    /**
     * Compresión PWG: por cada grupo de filas idénticas un byte (repeticiones - 1)
     * y luego corridas de píxeles: 0..127 = repetir el siguiente píxel n+1 veces,
     * 129..255 = (257 - n) píxeles literales.
     */
    private static void writePixels(OutputStream out, Page p, RowSource rows) throws IOException {
        int w = p.widthPx;
        int bpp = p.color ? 3 : 1;
        int[] argb = new int[w];
        byte[] line = new byte[w * bpp];
        byte[] next = new byte[w * bpp];

        rows.getRow(0, argb);
        toBytes(argb, line, p.color);
        int y = 0;
        while (y < p.heightPx) {
            int repeat = 1;
            while (y + repeat < p.heightPx && repeat < 256) {
                rows.getRow(y + repeat, argb);
                toBytes(argb, next, p.color);
                if (!java.util.Arrays.equals(line, next)) break;
                repeat++;
            }
            out.write(repeat - 1);
            encodeLine(out, line, w, bpp);
            y += repeat;
            if (y < p.heightPx) {
                // `next` ya tiene la fila y (la que cortó la repetición), salvo
                // que el corte haya sido por llegar a 256.
                if (repeat == 256) {
                    rows.getRow(y, argb);
                    toBytes(argb, next, p.color);
                }
                byte[] t = line;
                line = next;
                next = t;
            }
        }
    }

    private static void toBytes(int[] argb, byte[] dst, boolean color) {
        for (int x = 0; x < argb.length; x++) {
            int c = argb[x];
            int a = (c >>> 24) & 0xFF;
            int r = (c >> 16) & 0xFF, g = (c >> 8) & 0xFF, b = c & 0xFF;
            if (a < 255) { // componer sobre blanco
                r = (r * a + 255 * (255 - a)) / 255;
                g = (g * a + 255 * (255 - a)) / 255;
                b = (b * a + 255 * (255 - a)) / 255;
            }
            if (color) {
                dst[x * 3] = (byte) r;
                dst[x * 3 + 1] = (byte) g;
                dst[x * 3 + 2] = (byte) b;
            } else {
                dst[x] = (byte) ((r * 299 + g * 587 + b * 114) / 1000);
            }
        }
    }

    private static boolean samePixel(byte[] line, int i, int j, int bpp) {
        for (int k = 0; k < bpp; k++) if (line[i * bpp + k] != line[j * bpp + k]) return false;
        return true;
    }

    private static void encodeLine(OutputStream out, byte[] line, int w, int bpp) throws IOException {
        int x = 0;
        while (x < w) {
            int run = 1;
            while (x + run < w && run < MAX_RUN && samePixel(line, x, x + run, bpp)) run++;
            if (run > 1) {
                out.write(run - 1);
                out.write(line, x * bpp, bpp);
                x += run;
                continue;
            }
            // Literales: hasta que aparezcan dos píxeles iguales seguidos
            int lit = 1;
            while (x + lit < w && lit < MAX_RUN
                    && !(x + lit + 1 < w && samePixel(line, x + lit, x + lit + 1, bpp))) {
                lit++;
            }
            if (lit == 1) {
                out.write(0); // un solo píxel se codifica como repetición de 1
            } else {
                out.write(257 - lit);
            }
            out.write(line, x * bpp, lit * bpp);
            x += lit;
        }
    }
}
