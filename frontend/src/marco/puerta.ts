/**
 * Por que no se esta dentro, y que ofrecer para salir de ahi. **Funcion pura.**
 *
 * <h2>Las cuatro razones son cuatro remedios distintos, y por eso no se pueden juntar</h2>
 *
 * <table>
 *   <tr><td>el emisor dijo que no</td><td>lo que dijo, tal cual</td></tr>
 *   <tr><td>el origen no es seguro</td><td>no hay `crypto.subtle`, asi que no hay S256</td></tr>
 *   <tr><td>se acaba de cerrar sesion</td><td>no se vuelve a entrar solo</td></tr>
 *   <tr><td>tres idas sin canjear</td><td>un bucle, y se para</td></tr>
 * </table>
 *
 * Ensenar «no se pudo entrar» para las cuatro obliga a quien atiende a llamar por telefono para
 * averiguar cual de las cuatro es. Y dos de ellas **no son averias**: cerrar sesion es el sistema
 * funcionando, y el tope de idas es un freno que salto a proposito.
 *
 * <h2>Y por que es una funcion pura, sin React y sin leer `identidad.ts`</h2>
 *
 * Porque asi las cuatro razones se prueban sin montar nada y sin tocar `sessionStorage`. Quien
 * la llama —`Puerta.tsx`— es el que reune el estado; aqui entra un objeto plano y sale que decir.
 * Es la misma forma que `arbol.ts`, `filtro.ts` y `pestanas.ts` ya tienen en este directorio.
 */

/** Lo que hay que saber para decidir que decir. Lo reune quien dibuja. */
export interface EstadoDeLaPuerta {
  /** `crypto.subtle`, que es lo que S256 necesita. Falta fuera de un origen seguro. */
  readonly hayPuerta: boolean;
  /** Se acaba de cerrar sesion: el arranque no debe volver a entrar solo. */
  readonly vieneDeSalir: boolean;
  /** Quedan idas dentro del tope. */
  readonly puedeIrALaPuerta: boolean;
  /** Lo que dijo el emisor en el ultimo canje que fallo, si lo hubo. */
  readonly ultimoFallo: { readonly motivo: string; readonly detalle: string } | null;
}

/** Que decir, y que ofrecer. */
export interface RazonDeLaPuerta {
  /** Identificador estable. Es lo que las pruebas nombran, y no el texto en castellano. */
  readonly clave: 'el-emisor-no-dejo' | 'origen-inseguro' | 'se-cerro-sesion' | 'demasiadas-idas';
  readonly titulo: string;
  /** Lo que paso, en una frase. Cuando el emisor lo dice, es lo que el emisor dijo. */
  readonly detalle: string;
  /** Que hacer para salir de aqui. Nunca «reintente» a secas. */
  readonly remedio: string;
  /** Si se ofrece el boton que vuelve a la puerta. */
  readonly ofreceEntrar: boolean;
  /** Si esto es el sistema roto o el sistema funcionando. Decide el tono del aviso. */
  readonly esAveria: boolean;
}

/**
 * En cual de las cuatro razones estamos.
 *
 * **El orden de las ramas es el criterio.** El fallo del emisor va el primero porque es el unico
 * que trae informacion de fuera: si se mirara despues del tope de idas, tres rebotes seguidos
 * contra un `redirect_uri` mal declarado ensenarian «se intento tres veces» —que es cierto y no
 * sirve— en vez de «Invalid parameter: redirect_uri», que nombra la linea que hay que cambiar.
 * Es el defecto de [`rentas`#71](https://github.com/hneyra/rentas/issues/71) visto desde la
 * pantalla.
 */
export function razonDeLaPuerta(estado: EstadoDeLaPuerta): RazonDeLaPuerta {
  if (estado.ultimoFallo !== null) {
    return {
      clave: 'el-emisor-no-dejo',
      titulo: estado.ultimoFallo.motivo,
      detalle: estado.ultimoFallo.detalle,
      remedio:
        'Vuelva a identificarse. Si se repite, lo que hay que revisar es el cliente ' +
        '«kamayuk-backoffice» del realm: su URI de retorno tiene que admitir la raíz de esta ' +
        'aplicación, que es «/normativa/».',
      ofreceEntrar: true,
      esAveria: true,
    };
  }

  if (!estado.hayPuerta) {
    return {
      clave: 'origen-inseguro',
      titulo: 'Este puesto no puede identificarse',
      detalle:
        'El navegador no expone «crypto.subtle», que es lo que hace falta para calcular el reto ' +
        'PKCE S256. Sólo lo expone en un origen seguro: «https://», o «http://localhost».',
      remedio:
        'Abra esta pantalla por HTTPS o por «localhost». Servida por su dirección IP, la puerta ' +
        'de identidad no puede funcionar.',
      // No se ofrece: `entrar()` volveria aqui, porque no hay con que calcular el reto.
      ofreceEntrar: false,
      esAveria: true,
    };
  }

  if (estado.vieneDeSalir) {
    return {
      clave: 'se-cerro-sesion',
      titulo: 'Se cerró la sesión',
      detalle: 'La sesión terminó aquí y en el emisor. No queda ningún token en este navegador.',
      remedio: 'Vuelva a identificarse para entrar de nuevo.',
      ofreceEntrar: true,
      // No es una averia: es exactamente lo que se pidio.
      esAveria: false,
    };
  }

  return {
    clave: 'demasiadas-idas',
    titulo: 'Se intentó entrar tres veces y no se pudo',
    detalle:
      'El navegador fue al emisor tres veces seguidas y ninguna volvió con un código que se ' +
      'pudiera canjear. Se para aquí a propósito: seguir sería un rebote sin fin, con la ' +
      'pantalla en blanco parpadeando.',
    remedio:
      'Pruebe una vez más. Si vuelve a pararse, revise que el emisor esté levantado y que este ' +
      'origen esté entre los «webOrigins» del cliente «kamayuk-backoffice».',
    ofreceEntrar: true,
    esAveria: true,
  };
}
