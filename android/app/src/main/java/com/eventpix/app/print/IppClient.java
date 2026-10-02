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
import java.util.Locale;

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
        /** Tamaño en centésimas de mm; se usa solo con borderless. */
        public int mediaWidthHmm;
        public int mediaHeightHmm;
        public boolean borderless;
        /** "fill", "fit", "auto"... Null = no se envía. */
        public String printScaling;
        public boolean highQuality = true;
    }

    public static final class Result {
        public final int statusCode;
        public final int jobId;
        public final String statusMessage;

        Result(int statusCode, int jobId, String statusMessage) {
            this.statusCode = statusCode;
            this.jobId = jobId;
            this.statusMessage = statusMessage;
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
        String uri = printerUri(host, port, resourcePath);
        byte[] ippRequest = buildPrintJobRequest(uri, documentFormat, document, options, 1);
        byte[] ippResponse = httpPost(host, port, normalizePath(resourcePath), ippRequest);
        return parseResponse(ippResponse);
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

        if (o.borderless && o.mediaWidthHmm > 0 && o.mediaHeightHmm > 0) {
            // media-col { media-size { x-dimension, y-dimension }, márgenes en 0 }
            writeValue(out, TAG_BEG_COLLECTION, "media-col", new byte[0]);
            writeMember(out, "media-size");
            writeValue(out, TAG_BEG_COLLECTION, "", new byte[0]);
            writeMember(out, "x-dimension");
            writeInt(out, TAG_INTEGER, "", o.mediaWidthHmm);
            writeMember(out, "y-dimension");
            writeInt(out, TAG_INTEGER, "", o.mediaHeightHmm);
            writeValue(out, TAG_END_COLLECTION, "", new byte[0]);
            for (String margin : new String[]{"media-top-margin", "media-bottom-margin",
                    "media-left-margin", "media-right-margin"}) {
                writeMember(out, margin);
                writeInt(out, TAG_INTEGER, "", 0);
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
        int status = ((body[2] & 0xFF) << 8) | (body[3] & 0xFF);
        int jobId = -1;
        String message = null;

        int i = 8;
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
            if ("job-id".equals(name) && tag == TAG_INTEGER && valueLen == 4) {
                jobId = ((body[i] & 0xFF) << 24) | ((body[i + 1] & 0xFF) << 16)
                        | ((body[i + 2] & 0xFF) << 8) | (body[i + 3] & 0xFF);
            } else if ("status-message".equals(name) && tag == TAG_TEXT_WITHOUT_LANGUAGE) {
                message = new String(body, i, valueLen, StandardCharsets.UTF_8);
            }
            i += valueLen;
        }
        return new Result(status, jobId, message);
    }

    private static int readShort(byte[] b, int i) {
        return ((b[i] & 0xFF) << 8) | (b[i + 1] & 0xFF);
    }

    // ─── HTTP/1.1 mínimo ────────────────────────────────────────────

    static byte[] httpPost(String host, int port, String path, byte[] payload) throws IOException {
        try (Socket socket = new Socket()) {
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
