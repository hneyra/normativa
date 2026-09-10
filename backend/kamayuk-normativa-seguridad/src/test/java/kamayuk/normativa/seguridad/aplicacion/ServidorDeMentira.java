package kamayuk.normativa.seguridad.aplicacion;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.function.BiFunction;

/**
 * Un servidor HTTP minimo sobre un {@code ServerSocket}, para que el cliente de verdad hable con
 * algo de verdad. Copiado del arnes del ingestor de {@code rentas}: Checkstyle prohibe {@code
 * com.sun.net.httpserver}, y un doble que devolviera objetos no ejerceria el transporte.
 *
 * <p>Contesta con lo que devuelva {@code responder(ruta, cuerpo)}; si esa funcion lanza, contesta
 * 500 con el nombre de la excepcion. Cierra la conexion tras cada respuesta.
 */
final class ServidorDeMentira implements AutoCloseable {

    private final ServerSocket puerta;
    private final Thread atencion;
    private final BiFunction<String, String, Respuesta> responder;

    /** Lo que se contesta: estado y cuerpo. */
    record Respuesta(int estado, String cuerpo) {
        static Respuesta ok(String cuerpo) {
            return new Respuesta(200, cuerpo);
        }
    }

    private ServidorDeMentira(
            ServerSocket puerta, BiFunction<String, String, Respuesta> responder) {
        this.puerta = puerta;
        this.responder = responder;
        this.atencion = Thread.ofVirtual().name("servidor-de-mentira").unstarted(this::atender);
    }

    static ServidorDeMentira arrancar(BiFunction<String, String, Respuesta> responder)
            throws IOException {
        ServerSocket puerta = new ServerSocket(0, 0, InetAddress.getLoopbackAddress());
        ServidorDeMentira instancia = new ServidorDeMentira(puerta, responder);
        instancia.atencion.start();
        return instancia;
    }

    String raiz() {
        return "http://127.0.0.1:" + puerta.getLocalPort();
    }

    @Override
    public void close() throws IOException {
        puerta.close();
    }

    private void atender() {
        while (!puerta.isClosed()) {
            try {
                Socket conexion = puerta.accept();
                Thread.ofVirtual().start(() -> contestar(conexion));
            } catch (IOException cerrada) {
                return;
            }
        }
    }

    /**
     * Lee la peticion EN BYTES y no en caracteres: {@code Content-Length} cuenta bytes, y un cuerpo
     * con una tilde o un guion largo tiene mas bytes que caracteres. La primera version leia {@code
     * largo} CARACTERES con un {@code BufferedReader}, asi que con cualquier cuerpo no ASCII se
     * quedaba esperando lo que nunca iba a llegar, el cliente agotaba su espera y la respuesta solo
     * salia cuando el cliente cerraba —o sea, un aviso que «se entregaba» diez segundos despues de
     * que el remitente lo diera por perdido—.
     */
    @SuppressWarnings("checkstyle:IllegalCatch")
    private void contestar(Socket conexion) {
        try (Socket abierta = conexion;
                InputStream entrada = abierta.getInputStream();
                OutputStream salida = abierta.getOutputStream()) {
            String peticion = leerLinea(entrada);
            if (peticion == null) {
                return;
            }
            String ruta = peticion.split(" ")[1];
            int largo = 0;
            String linea;
            while ((linea = leerLinea(entrada)) != null && !linea.isEmpty()) {
                if (linea.toLowerCase(Locale.ROOT).startsWith("content-length:")) {
                    largo = Integer.parseInt(linea.substring(linea.indexOf(':') + 1).strip());
                }
            }
            byte[] cuerpoEnBytes = largo > 0 ? entrada.readNBytes(largo) : new byte[0];
            String cuerpo = new String(cuerpoEnBytes, StandardCharsets.UTF_8);
            Respuesta respuesta;
            try {
                respuesta = responder.apply(ruta, cuerpo);
            } catch (RuntimeException fallo) {
                respuesta =
                        new Respuesta(
                                500, "{\"error\":\"" + fallo.getClass().getSimpleName() + "\"}");
            }
            byte[] bytes = respuesta.cuerpo().getBytes(StandardCharsets.UTF_8);
            salida.write(
                    ("HTTP/1.1 "
                                    + respuesta.estado()
                                    + " \r\nContent-Type: application/json\r\nContent-Length: "
                                    + bytes.length
                                    + "\r\nConnection: close\r\n\r\n")
                            .getBytes(StandardCharsets.UTF_8));
            salida.write(bytes);
            salida.flush();
        } catch (IOException seCorto) {
            // El cliente cerro antes de leer. No es un fallo de la prueba.
        }
    }

    /** Una linea de cabecera, terminada en CRLF, en bytes. {@code null} si la conexion se cerro. */
    private static String leerLinea(InputStream entrada) throws IOException {
        StringBuilder linea = new StringBuilder();
        int b;
        while ((b = entrada.read()) >= 0) {
            if (b == '\n') {
                int fin = linea.length();
                if (fin > 0 && linea.charAt(fin - 1) == '\r') {
                    linea.setLength(fin - 1);
                }
                return linea.toString();
            }
            linea.append((char) b);
        }
        return linea.isEmpty() ? null : linea.toString();
    }
}
