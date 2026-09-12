import {
  entrar,
  hayPuerta,
  olvidarLaParada,
  puedeIrALaPuerta,
  token,
  ultimoFalloDeLaPuerta,
  vieneDeSalir,
} from './api/identidad.ts';
import { Marco } from './marco/Marco.tsx';
import { Puerta } from './marco/Puerta.tsx';
import { razonDeLaPuerta } from './marco/puerta.ts';

/**
 * El casco de `normativa-web`: **primero quien eres, y solo entonces el marco**.
 *
 * <h2>Por que la decision esta aqui y no dentro del marco</h2>
 *
 * Porque es la unica decision del casco y tiene dos salidas que no se pueden tomar dos veces. Si
 * cada seccion mirara la suya, un 401 saldria cuatro veces en cuatro avisos distintos, cada uno
 * pidiendo su remedio, y el marco de fondo dibujando un panel sin ediciones, unos cuadros vacios
 * y una publicacion sin conjuntos — tres pantallas que se ven exactamente igual que «no hay
 * ediciones abiertas», «este ejercicio no tiene cuadros» y «no hay nada publicado». En el sistema
 * cuyo trabajo entero es decir que cifra rige, esa es la peor manera posible de mentir.
 *
 * <h2>Y por que se mira el TOKEN y no una lectura de la API</h2>
 *
 * `rentas` decide esto pidiendo `GET /seguridad/sesion` y leyendo su fallo: alli el casco tiene
 * una lectura obligatoria al montar. Aqui no la hay —las cuatro operaciones de este sistema las
 * piden las secciones, cada una la suya— asi que inventar una peticion de arranque solo para
 * poder mirar su 401 seria un viaje de red que no trae ningun dato. Lo que sostiene esta rama es
 * que **sin token ninguna de las cuatro puede contestar nada**: `SeguridadWeb.cadenaDeSeguridad`
 * deja `authenticated()` todo lo que cuelga de la raiz de la API, y el inquilino sale del token.
 *
 * <h2>Que NO decide este casco</h2>
 *
 * Los 403. `SIN_MUNICIPALIDAD` —el token es valido y no trae el claim— y `SIN_PRIVILEGIO` —la
 * cuenta no tiene el permiso de esa pantalla— llegan **por operacion** y se contestan donde se
 * piden: mandarlos aqui cerraria el sistema entero por una pantalla que esa cuenta no puede
 * abrir. Lo que cierra el sistema entero es no tener token, que es lo unico que se mira.
 *
 * <h2>El token se lee al dibujar, y con eso basta</h2>
 *
 * `arrancar()` canjea **antes** de montar, asi que cuando este componente se dibuja el token ya
 * esta o ya no va a estar. No hace falta ningun estado ni ninguna suscripcion: lo unico que puede
 * cambiarlo despues es `salir()`, que navega fuera de la pagina.
 */
export function Aplicacion() {
  if (token() !== null) return <Marco />;

  const volverAIdentificarse = () => {
    // Se olvida la parada ANTES de salir: el tope de tres idas existe para cortar un bucle
    // automatico, y esto es una persona pulsando un boton. Sin olvidarla, el cuarto clic no
    // haria nada y no diria por que.
    olvidarLaParada();
    void entrar();
  };

  return (
    <Puerta
      razon={razonDeLaPuerta({
        hayPuerta: hayPuerta(),
        vieneDeSalir: vieneDeSalir(),
        puedeIrALaPuerta: puedeIrALaPuerta(),
        ultimoFallo: ultimoFalloDeLaPuerta(),
      })}
      alVolverAIdentificarse={volverAIdentificarse}
    />
  );
}
