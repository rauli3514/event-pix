package com.eventpix.app.print;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Busca impresoras IPP con una consulta mDNS "legacy unicast" (RFC 6762 §6.7):
 * se pregunta desde un puerto cualquiera y los equipos responden por unicast.
 * Sirve en redes donde NsdManager no busca (p. ej. una red pedida con
 * WifiNetworkSpecifier). Java puro para poder probarlo fuera de Android.
 */
public final class MdnsLookup {

    private static final String SERVICE = "_ipp._tcp.local";
    private static final int TYPE_A = 1;
    private static final int TYPE_PTR = 12;
    private static final int TYPE_TXT = 16;
    private static final int TYPE_SRV = 33;

    private MdnsLookup() {}

    /** Permite atar el socket a una red puntual (Network.bindSocket). */
    public interface SocketBinder {
        void bind(DatagramSocket socket) throws IOException;
    }

    public static final class Printer {
        public String instance = "";
        public String name = "";
        public String host = "";
        public int port = 631;
        public String rp = "ipp/print";
        public String pdl = "";
    }

    public static List<Printer> findIppPrinters(SocketBinder binder, long timeoutMs) throws IOException {
        try (DatagramSocket socket = new DatagramSocket(null)) {
            if (binder != null) binder.bind(socket);
            socket.bind(null);
            byte[] query = buildQuery(SERVICE, TYPE_PTR);
            InetAddress group = InetAddress.getByName("224.0.0.251");
            socket.send(new DatagramPacket(query, query.length, group, 5353));

            Map<String, Printer> found = new LinkedHashMap<>();
            long deadline = System.currentTimeMillis() + timeoutMs;
            byte[] buf = new byte[9000];
            while (true) {
                long left = deadline - System.currentTimeMillis();
                if (left <= 0) break;
                socket.setSoTimeout((int) left);
                DatagramPacket packet = new DatagramPacket(buf, buf.length);
                try {
                    socket.receive(packet);
                } catch (SocketTimeoutException e) {
                    break;
                }
                try {
                    parseResponse(packet.getData(), packet.getLength(), packet.getAddress(), found);
                } catch (RuntimeException ignored) {
                    // paquete malformado: se ignora
                }
            }
            List<Printer> result = new ArrayList<>();
            for (Printer p : found.values()) if (!p.host.isEmpty()) result.add(p);
            return result;
        }
    }

    static byte[] buildQuery(String name, int type) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int id = 0x4550; // un id distinto de 0 indica "legacy unicast"
        out.write(id >> 8);
        out.write(id & 0xFF);
        writeShort(out, 0);  // flags: consulta estándar
        writeShort(out, 1);  // QDCOUNT
        writeShort(out, 0);
        writeShort(out, 0);
        writeShort(out, 0);
        for (String label : name.split("\\.")) {
            byte[] b = label.getBytes(StandardCharsets.UTF_8);
            out.write(b.length);
            out.write(b, 0, b.length);
        }
        out.write(0);
        writeShort(out, type);
        writeShort(out, 1);  // clase IN
        return out.toByteArray();
    }

    private static void writeShort(ByteArrayOutputStream out, int v) {
        out.write((v >> 8) & 0xFF);
        out.write(v & 0xFF);
    }

    static void parseResponse(byte[] msg, int len, InetAddress sender, Map<String, Printer> found) {
        if (len < 12 || (msg[2] & 0x80) == 0) return; // no es respuesta
        int qd = u16(msg, 4);
        int records = u16(msg, 6) + u16(msg, 8) + u16(msg, 10);
        int[] pos = {12};
        for (int i = 0; i < qd; i++) {
            readName(msg, len, pos);
            pos[0] += 4;
        }

        Map<String, String> srvTarget = new HashMap<>();
        Map<String, String> addresses = new HashMap<>();
        for (int i = 0; i < records && pos[0] < len; i++) {
            String owner = readName(msg, len, pos);
            int type = u16(msg, pos[0]);
            int rdLen = u16(msg, pos[0] + 8);
            int rd = pos[0] + 10;
            pos[0] = rd + rdLen;
            if (pos[0] > len) break;

            if (type == TYPE_PTR && owner.equalsIgnoreCase(SERVICE)) {
                String instance = readName(msg, len, new int[]{rd});
                printer(found, instance);
            } else if (type == TYPE_SRV) {
                Printer p = printer(found, owner);
                p.port = u16(msg, rd + 4);
                srvTarget.put(owner.toLowerCase(), readName(msg, len, new int[]{rd + 6}).toLowerCase());
            } else if (type == TYPE_TXT) {
                Printer p = printer(found, owner);
                int t = rd;
                while (t < rd + rdLen) {
                    int l = msg[t] & 0xFF;
                    String kv = new String(msg, t + 1, l, StandardCharsets.UTF_8);
                    t += 1 + l;
                    int eq = kv.indexOf('=');
                    if (eq <= 0) continue;
                    String key = kv.substring(0, eq).toLowerCase();
                    String value = kv.substring(eq + 1);
                    if (key.equals("rp")) p.rp = value;
                    else if (key.equals("pdl")) p.pdl = value;
                    else if (key.equals("ty")) p.name = value;
                }
            } else if (type == TYPE_A && rdLen == 4) {
                addresses.put(owner.toLowerCase(), (msg[rd] & 0xFF) + "." + (msg[rd + 1] & 0xFF) + "."
                        + (msg[rd + 2] & 0xFF) + "." + (msg[rd + 3] & 0xFF));
            }
        }

        for (Map.Entry<String, Printer> e : found.entrySet()) {
            Printer p = e.getValue();
            if (!p.host.isEmpty()) continue;
            String target = srvTarget.get(e.getKey());
            String ip = target != null ? addresses.get(target) : null;
            // Sin registro A, quien respondió por este servicio es la impresora
            if (ip == null && target != null && sender != null) ip = sender.getHostAddress();
            if (ip != null) p.host = ip;
        }
    }

    private static Printer printer(Map<String, Printer> found, String instance) {
        String key = instance.toLowerCase();
        Printer p = found.get(key);
        if (p == null) {
            p = new Printer();
            p.instance = instance;
            String suffix = "." + SERVICE;
            p.name = instance.toLowerCase().endsWith(suffix)
                    ? instance.substring(0, instance.length() - suffix.length()) : instance;
            found.put(key, p);
        }
        return p;
    }

    /** Lee un nombre DNS con compresión; avanza pos[0] hasta después del nombre. */
    static String readName(byte[] msg, int len, int[] pos) {
        StringBuilder sb = new StringBuilder();
        int p = pos[0];
        boolean jumped = false;
        int hops = 0;
        while (p < len) {
            int l = msg[p] & 0xFF;
            if (l == 0) {
                p++;
                break;
            }
            if ((l & 0xC0) == 0xC0) {
                if (!jumped) pos[0] = p + 2;
                jumped = true;
                p = ((l & 0x3F) << 8) | (msg[p + 1] & 0xFF);
                if (++hops > 64) throw new IllegalStateException("nombre DNS en bucle");
                continue;
            }
            if (sb.length() > 0) sb.append('.');
            sb.append(new String(msg, p + 1, l, StandardCharsets.UTF_8));
            p += 1 + l;
        }
        if (!jumped) pos[0] = p;
        return sb.toString();
    }

    private static int u16(byte[] b, int i) {
        return ((b[i] & 0xFF) << 8) | (b[i + 1] & 0xFF);
    }
}
