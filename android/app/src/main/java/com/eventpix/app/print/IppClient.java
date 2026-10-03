package com.eventpix.app.print;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import javax.net.SocketFactory;

/**
 * Cliente IPP mínimo (RFC 8010/8011) para mandar un Print-Job directo a una
 * impresora de red, sin diálogo del sistema. Java puro, sin dependencias de
 * Android, para poder probarlo fuera del dispositivo.
 *
 * El HTTP va por un Socket propio: las impresoras de la LAN hablan HTTP plano
 * y así no hace falta habilitar cleartext para toda la app.
 */
public final class IppClient {

    // Delimitadores de grupo
    private static final int TAG_OPERATION_ATTRIBUTES = 0x01;
    private static final int TAG_JOB_ATTRIBUTES = 0x02;
    private static final int TAG_END_OF_ATTRIBUTES = 0x03;

    // Tipos de valor
    private static final int TAG_INTEGER = 0x21;
    private static final int TAG_RESOLUTION = 0x32;
    private static final int TAG_ENUM = 0x23;
    private static final int TAG_BEG_COLLECTION = 0x34;
    private static final int TAG_END_COLLECTION = 0x37;
    private static final int TAG_NAME_WITHOUT_LANGUAGE = 0x42;
    private static final int TAG_TEXT_WITHOUT_LANGUAGE = 0x41;
    private static final int TAG_KEYWORD = 0x44;
    private static final int TAG_URI = 0x45;
    private static final int TAG_CHARSET = 0x47;
    private static final int TAG_NATURAL_LANGUAGE = 0x48;
    private static final int TAG_MIME_MEDIA_TYPE = 0x49;
    private static final int TAG_MEMBER_ATTR_NAME = 0x4A;

    private static final int OP_PRINT_JOB = 0x0002;
    private static final int OP_GET_PRINTER_ATTRIBUTES = 0x000B;
    private static final int RESOLUTION_UNITS_DPI = 3;
    private static final int PRINT_QUALITY_HIGH = 5;

    private static final int CONNECT_TIMEOUT_MS = 5000;
    private static final int READ_TIMEOUT_MS = 90000;

    private IppClient() {}

    public static final class Options {
        public String jobName = "EventPix";
        public String userName = "EventPix";
        public int copies = 1;
        /** Keyword PWG 5101.1, p. ej. "na_index-4x6_4x6in". Null = default de la impresora. */
        public String mediaKeyword;
        /** Tamaño en centésimas de mm. Si está, se manda media-col en vez de `media`. */
        public int mediaWidthHmm;
        public int mediaHeightHmm;
        /** Keyword PWG, p. ej. "photographic-glossy". Null = default de la impresora. */
        public String mediaType;
        public boolean borderless;
        /** "fill", "fit", "auto"... Null = no se envía. */
        public String printScaling;
        public boolean highQuality = true;
    }

    /** Un valor de atributo IPP crudo (tag + bytes). */
    public static final class Value {
        public final int tag;
        public final byte[] bytes;

        Value(int tag, byte[] bytes) {
            this.tag = tag;
            this.bytes = bytes;
        }

        public String asString() {
            return new String(bytes, StandardCharsets.UTF_8);
        }

        public int asInt() {
            return bytes.length == 4 ? readInt(bytes, 0) : -1;
        }

        /** Para resoluciones: dpi horizontal, o -1 si no es una resolución en dpi. */
        public int asDpi() {
            if (tag != TAG_RESOLUTION || bytes.length != 9) return -1;
            int x = readInt(bytes, 0);
            int units = bytes[8] & 0xFF;
            return units == RESOLUTION_UNITS_DPI ? x : Math.round(x * 2.54f);
        }
    }

    public static final class Result {
        public final int statusCode;
        public final int jobId;
        public final String statusMessage;
        /** Atributos de primer nivel de la respuesta (los valores extra se agregan a la lista). */
        public final Map<String, List<Value>> attributes;

        Result(int statusCode, int jobId, String statusMessage, Map<String, List<Value>> attributes) {
            this.statusCode = statusCode;
            this.jobId = jobId;
            this.statusMessage = statusMessage;
            this.attributes = attributes;
        }

        public List<Value> get(String name) {
            List<Value> v = attributes.get(name);
            return v != null ? v : new ArrayList<>();
        }

        /** 0x0000-0x00FF son "successful-ok*". */
        public boolean isSuccess() {
            return statusCode >= 0x0000 && statusCode <= 0x00FF;
        }
    }

    public static String printerUri(String host, int port, String resourcePath) {
        String h = host.contains(":") && !host.startsWith("[") ? "[" + host + "]" : host;
        return "ipp://" + h + ":" + port + normalizePath(resourcePath);
    }

    static String normalizePath(String resourcePath) {
        if (resourcePath == null || resourcePath.isEmpty()) return "/ipp/print";
        return resourcePath.startsWith("/") ? resourcePath : "/" + resourcePath;
    }

    public static Result printJob(String host, int port, String resourcePath, String documentFormat,
                                  byte[] document, Options options) throws IOException {
        return printJob(null, host, port, resourcePath, documentFormat, document, options);
    }

    /** @param sockets fábrica de sockets de una red puntual (Network.getSocketFactory), o null. */
    public static Result printJob(SocketFactory sockets, String host, int port, String resourcePath,
                                  String documentFormat, byte[] document, Options options) throws IOException {
        String uri = printerUri(host, port, resourcePath);
        byte[] ippRequest = buildPrintJobRequest(uri, documentFormat, document, options, 1);
        byte[] ippResponse = httpPost(sockets, host, port, normalizePath(resourcePath), ippRequest);
        return parseResponse(ippResponse);
    }

    public static Result getPrinterAttributes(String host, int port, String resourcePath,
                                              String... requested) throws IOException {
        return getPrinterAttributes(null, host, port, resourcePath, requested);
    }

    public static Result getPrinterAttributes(SocketFactory sockets, String host, int port, String resourcePath,
                                              String... requested) throws IOException {
        String uri = printerUri(host, port, resourcePath);
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        DataOutputStream out = new DataOutputStream(buf);
        out.writeByte(1);
        out.writeByte(1);
        out.writeShort(OP_GET_PRINTER_ATTRIBUTES);
        out.writeInt(1);
        out.writeByte(TAG_OPERATION_ATTRIBUTES);
        writeString(out, TAG_CHARSET, "attributes-charset", "utf-8");
        writeString(out, TAG_NATURAL_LANGUAGE, "attributes-natural-language", "es");
        writeString(out, TAG_URI, "printer-uri", uri);
        writeString(out, TAG_NAME_WITHOUT_LANGUAGE, "requesting-user-name", "EventPix");
        for (int i = 0; i < requested.length; i++) {
            // 1setOf: el primer valor lleva el nombre, los siguientes van sin nombre
            writeString(out, TAG_KEYWORD, i == 0 ? "requested-attributes" : "", requested[i]);
        }
        out.writeByte(TAG_END_OF_ATTRIBUTES);
        out.flush();
        return parseResponse(httpPost(sockets, host, port, normalizePath(resourcePath), buf.toByteArray()));
    }

    /** La resolución preferida si está; si no, la menor que la supere (las Epson suelen pedir 360). */
    public static int pickResolution(List<Value> values, int preferredDpi) {
        int best = -1;
        int max = -1;
        for (Value v : values) {
            int dpi = v.asDpi();
            if (dpi <= 0) continue;
            if (dpi == preferredDpi) return preferredDpi;
            if (dpi > preferredDpi && (best < 0 || dpi < best)) best = dpi;
            max = Math.max(max, dpi);
        }
        if (best > 0) return best;
        return max > 0 ? max : preferredDpi;
    }

    /** "photographic-glossy" si está; si no, el primer tipo fotográfico; si no, null. */
    public static String pickPhotoMediaType(List<Value> values) {
        String fallback = null;
        for (Value v : values) {
            String type = v.asString();
            if (type.equals("photographic-glossy")) return type;
            if (fallback == null && type.startsWith("photographic")) fallback = type;
        }
        return fallback;
    }

    static byte[] buildPrintJobRequest(String printerUri, String documentFormat, byte[] document,
                                       Options o, int requestId) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream(document.length + 1024);
        DataOutputStream out = new DataOutputStream(buf);

        out.writeByte(1); // IPP/1.1
        out.writeByte(1);
        out.writeShort(OP_PRINT_JOB);
        out.writeInt(requestId);

        out.writeByte(TAG_OPERATION_ATTRIBUTES);
        writeString(out, TAG_CHARSET, "attributes-charset", "utf-8");
        writeString(out, TAG_NATURAL_LANGUAGE, "attributes-natural-language", "es");
        writeString(out, TAG_URI, "printer-uri", printerUri);
        writeString(out, TAG_NAME_WITHOUT_LANGUAGE, "requesting-user-name", o.userName);
        writeString(out, TAG_NAME_WITHOUT_LANGUAGE, "job-name", o.jobName);
        writeString(out, TAG_MIME_MEDIA_TYPE, "document-format", documentFormat);

        out.writeByte(TAG_JOB_ATTRIBUTES);
        writeInt(out, TAG_INTEGER, "copies", Math.max(1, o.copies));
        if (o.highQuality) writeInt(out, TAG_ENUM, "print-quality", PRINT_QUALITY_HIGH);
        if (o.printScaling != null) writeString(out, TAG_KEYWORD, "print-scaling", o.printScaling);

        if (o.mediaWidthHmm > 0 && o.mediaHeightHmm > 0) {
            // media-col { media-size { x-dimension, y-dimension }, [media-type], [márgenes en 0] }
            writeValue(out, TAG_BEG_COLLECTION, "media-col", new byte[0]);
            writeMember(out, "media-size");
            writeValue(out, TAG_BEG_COLLECTION, "", new byte[0]);
            writeMember(out, "x-dimension");
            writeInt(out, TAG_INTEGER, "", o.mediaWidthHmm);
            writeMember(out, "y-dimension");
            writeInt(out, TAG_INTEGER, "", o.mediaHeightHmm);
            writeValue(out, TAG_END_COLLECTION, "", new byte[0]);
            if (o.mediaType != null && !o.mediaType.isEmpty()) {
                writeMember(out, "media-type");
                writeString(out, TAG_KEYWORD, "", o.mediaType);
            }
            if (o.borderless) {
                for (String margin : new String[]{"media-top-margin", "media-bottom-margin",
                        "media-left-margin", "media-right-margin"}) {
                    writeMember(out, margin);
                    writeInt(out, TAG_INTEGER, "", 0);
                }
            }
            writeValue(out, TAG_END_COLLECTION, "", new byte[0]);
        } else if (o.mediaKeyword != null && !o.mediaKeyword.isEmpty()) {
            writeString(out, TAG_KEYWORD, "media", o.mediaKeyword);
        }

        out.writeByte(TAG_END_OF_ATTRIBUTES);
        out.write(document);
        out.flush();
        return buf.toByteArray();
    }

    private static void writeMember(DataOutputStream out, String memberName) throws IOException {
        writeString(out, TAG_MEMBER_ATTR_NAME, "", memberName);
    }

    private static void writeString(DataOutputStream out, int tag, String name, String value) throws IOException {
        writeValue(out, tag, name, value.getBytes(StandardCharsets.UTF_8));
    }

    private static void writeInt(DataOutputStream out, int tag, String name, int value) throws IOException {
        writeValue(out, tag, name, new byte[]{
                (byte) (value >>> 24), (byte) (value >>> 16), (byte) (value >>> 8), (byte) value});
    }

    private static void writeValue(DataOutputStream out, int tag, String name, byte[] value) throws IOException {
        byte[] nameBytes = name.getBytes(StandardCharsets.UTF_8);
        out.writeByte(tag);
        out.writeShort(nameBytes.length);
        out.write(nameBytes);
        out.writeShort(value.length);
        out.write(value);
    }

    static Result parseResponse(byte[] body) throws IOException {
        if (body.length < 8) throw new IOException("Respuesta IPP inválida (" + body.length + " bytes)");
        int status = readShort(body, 2);
        Map<String, List<Value>> attrs = new HashMap<>();

        int i = 8;
        int depth = 0; // dentro de una colección se ignoran los miembros
        List<Value> current = null;
        while (i < body.length) {
            int tag = body[i++] & 0xFF;
            if (tag == TAG_END_OF_ATTRIBUTES) break;
            if (tag <= 0x0F) continue; // delimitador de grupo
            if (i + 2 > body.length) break;
            int nameLen = readShort(body, i);
            i += 2;
            if (i + nameLen + 2 > body.length) break;
            String name = new String(body, i, nameLen, StandardCharsets.UTF_8);
            i += nameLen;
            int valueLen = readShort(body, i);
            i += 2;
            if (i + valueLen > body.length) break;
            byte[] value = new byte[valueLen];
            System.arraycopy(body, i, value, 0, valueLen);
            i += valueLen;

            if (tag == TAG_BEG_COLLECTION) {
                if (depth == 0 && !name.isEmpty()) current = null;
                depth++;
                continue;
            }
            if (tag == TAG_END_COLLECTION) {
                depth = Math.max(0, depth - 1);
                continue;
            }
            if (depth > 0) continue;
            if (!name.isEmpty()) {
                current = new ArrayList<>();
                attrs.put(name, current);
            }
            if (current != null) current.add(new Value(tag, value));
        }

        List<Value> jobIds = attrs.get("job-id");
        int jobId = jobIds != null && !jobIds.isEmpty() && jobIds.get(0).tag == TAG_INTEGER
                ? jobIds.get(0).asInt() : -1;
        List<Value> messages = attrs.get("status-message");
        String message = messages != null && !messages.isEmpty()
                && messages.get(0).tag == TAG_TEXT_WITHOUT_LANGUAGE ? messages.get(0).asString() : null;
        return new Result(status, jobId, message, attrs);
    }

    private static int readInt(byte[] b, int i) {
        return ((b[i] & 0xFF) << 24) | ((b[i + 1] & 0xFF) << 16) | ((b[i + 2] & 0xFF) << 8) | (b[i + 3] & 0xFF);
    }

    private static int readShort(byte[] b, int i) {
        return ((b[i] & 0xFF) << 8) | (b[i + 1] & 0xFF);
    }

    // ─── HTTP/1.1 mínimo ────────────────────────────────────────────

    static byte[] httpPost(SocketFactory sockets, String host, int port, String path, byte[] payload)
            throws IOException {
        try (Socket socket = sockets != null ? sockets.createSocket() : new Socket()) {
            socket.connect(new InetSocketAddress(host, port), CONNECT_TIMEOUT_MS);
            socket.setSoTimeout(READ_TIMEOUT_MS);

            String hostHeader = (host.contains(":") ? "[" + host + "]" : host) + ":" + port;
            String headers = "POST " + path + " HTTP/1.1\r\n"
                    + "Host: " + hostHeader + "\r\n"
                    + "Content-Type: application/ipp\r\n"
                    + "Content-Length: " + payload.length + "\r\n"
                    + "User-Agent: EventPix\r\n"
                    + "Connection: close\r\n\r\n";
            OutputStream os = socket.getOutputStream();
            os.write(headers.getBytes(StandardCharsets.US_ASCII));
            os.write(payload);
            os.flush();

            return readHttpBody(new BufferedInputStream(socket.getInputStream()));
        }
    }

    static byte[] readHttpBody(InputStream in) throws IOException {
        int httpStatus;
        long contentLength = -1;
        boolean chunked = false;

        // Saltea respuestas 1xx (p. ej. "100 Continue")
        while (true) {
            String statusLine = readLine(in);
            if (statusLine == null) throw new IOException("La impresora cerró la conexión sin responder");
            String[] parts = statusLine.split(" ", 3);
            if (parts.length < 2) throw new IOException("Respuesta HTTP inválida: " + statusLine);
            httpStatus = Integer.parseInt(parts[1].trim());

            String line;
            while ((line = readLine(in)) != null && !line.isEmpty()) {
                int colon = line.indexOf(':');
                if (colon <= 0) continue;
                String key = line.substring(0, colon).trim().toLowerCase(Locale.ROOT);
                String value = line.substring(colon + 1).trim();
                if (key.equals("content-length")) contentLength = Long.parseLong(value);
                if (key.equals("transfer-encoding") && value.toLowerCase(Locale.ROOT).contains("chunked")) chunked = true;
            }
            if (httpStatus >= 200) break;
            contentLength = -1;
            chunked = false;
        }

        if (httpStatus != 200) throw new IOException("La impresora respondió HTTP " + httpStatus);

        ByteArrayOutputStream body = new ByteArrayOutputStream();
        if (chunked) {
            while (true) {
                String sizeLine = readLine(in);
                if (sizeLine == null) break;
                int semi = sizeLine.indexOf(';');
                int size = Integer.parseInt((semi >= 0 ? sizeLine.substring(0, semi) : sizeLine).trim(), 16);
                if (size == 0) break;
                copy(in, body, size);
                readLine(in); // CRLF tras el chunk
            }
        } else if (contentLength >= 0) {
            copy(in, body, contentLength);
        } else {
            byte[] b = new byte[4096];
            int n;
            while ((n = in.read(b)) != -1) body.write(b, 0, n);
        }
        return body.toByteArray();
    }

    private static void copy(InputStream in, ByteArrayOutputStream out, long count) throws IOException {
        byte[] b = new byte[4096];
        long remaining = count;
        while (remaining > 0) {
            int n = in.read(b, 0, (int) Math.min(b.length, remaining));
            if (n == -1) throw new IOException("Respuesta HTTP truncada");
            out.write(b, 0, n);
            remaining -= n;
        }
    }

    private static String readLine(InputStream in) throws IOException {
        StringBuilder sb = new StringBuilder();
        int c;
        while ((c = in.read()) != -1) {
            if (c == '\n') {
                int len = sb.length();
                if (len > 0 && sb.charAt(len - 1) == '\r') sb.setLength(len - 1);
                return sb.toString();
            }
            sb.append((char) c);
        }
        return sb.length() == 0 ? null : sb.toString();
    }
}
