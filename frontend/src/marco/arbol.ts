/**
 * El arbol de modulos y submodulos del marco V6, y las cuatro secciones propias.
 *
 * <h2>De donde sale, literalmente</h2>
 *
 * De `const ARBOL` (linea 1412 de `frontend/diseno/NormativaV6.dc.html`) y de `const SECS`
 * (linea 1450), con los iconos de `const MODULOS` (linea 1150) y `const ICO_SEC` (linea
 * 1166). **No se reescribio ninguno de los trazos**:
 * `verificaciones/arbol-del-artboard.test.ts` compara este archivo contra el artboard
 * vendorizado, entrada a entrada, y no contra una copia suya.
 *
 * <h2>Diez modulos y no trece, y quienes son los tres que salen</h2>
 *
 * El artboard declara **trece** modulos de cuatro submodulos cada uno. Salen tres, y el
 * motivo no es de diseno sino de reparto (ADR-0029): **`Catastro` es de `../catastro`,
 * `Tesoreria` es de `../caja` y `Rentas · Registro` es de `../rentas`**. Los tres tienen ya
 * su propia interfaz, asi que ofrecerlos aqui como pestana ajena seria ofrecer un destino
 * que otro repositorio sirve mejor.
 *
 * Que se queden **nueve modulos ajenos** no es un adorno: **es la unica forma de que exista
 * el caso del AC9**, la pestana ajena. Sin modulos que no sean el propio no hay submodulo
 * ajeno que abrir, y lo que el marco demuestra —navegar entre varias cosas abiertas a la
 * vez— deja de poder probarse. Quitar `Normativa` del arbol tiene el efecto simetrico y
 * tambien esta medido: la prueba del AC9 se queda sin caso.
 *
 * Diez modulos por cuatro submodulos son **40 destinos**.
 */

/** Un submodulo: la hoja del arbol, y lo que abre una pestana. */
export interface Submodulo {
  /** La clave que viaja al hash y a la lista de pestanas abiertas. */
  readonly clave: string;
  readonly rotulo: string;
}

/** Un modulo del sistema, con sus cuatro submodulos. */
export interface Modulo {
  readonly rotulo: string;
  /** La linea de debajo del rotulo: de que va el modulo. */
  readonly nota: string;
  /**
   * La clave del modulo. No se dibuja en ninguna parte —el panel se indexa por el rotulo,
   * como el artboard—, pero es lo que da identidad estable a la fila: `valores-mod` existe
   * justamente porque un modulo llamado «Valores» no puede compartir clave con nada.
   */
  readonly clave: string;
  /** Los `<path>` de su icono, tal como `const MODULOS` los escribe. */
  readonly trazos: readonly string[];
  readonly submodulos: readonly Submodulo[];
}

/**
 * El modulo propio: el que ESTE repositorio sirve.
 *
 * Sus cuatro submodulos llevan el prefijo `nor-`, igual que los otros nueve llevan el suyo
 * (`fis-panel`, `coa-exp`). No hay excepcion que explicar aqui: en NormativaV6 tambien el
 * modulo propio esta prefijado, asi que una seccion propia y una hoja ajena comparten el
 * mismo espacio de claves sin un mapa de traduccion en medio.
 */
export const MODULO_PROPIO = 'Normativa';

export const ARBOL: readonly Modulo[] = [
  {
    rotulo: 'Inicio',
    nota: 'Panel de recaudación',
    clave: 'inicio',
    trazos: ['M3 10.6 12 3.5l9 7.1', 'M5.6 9.6V20.5h12.8V9.6', 'M10 20.5v-5.4h4v5.4'],
    submodulos: [
      { clave: 'ini-panel', rotulo: 'Panel' },
      { clave: 'ini-flujo', rotulo: 'Recaudación' },
      { clave: 'ini-parado', rotulo: 'Trabajo parado' },
      { clave: 'ini-cierre', rotulo: 'Cierre del día' },
    ],
  },
  {
    rotulo: MODULO_PROPIO,
    nota: 'Parámetros sellados y corpus',
    clave: 'normativa',
    trazos: [
      'M5 5.4A1.9 1.9 0 0 1 6.9 3.5H19.2v13.4H6.9A1.9 1.9 0 0 0 5 18.8z',
      'M5 18.8a1.9 1.9 0 0 0 1.9 1.7H19.2v-2.9',
      'M8.7 8.1h6.6',
      'M8.7 11.6h4.2',
    ],
    submodulos: [
      { clave: 'nor-panel', rotulo: 'Panel' },
      { clave: 'nor-ediciones', rotulo: 'Ediciones' },
      { clave: 'nor-cuadros', rotulo: 'Cuadros de valuación' },
      { clave: 'nor-publicacion', rotulo: 'Publicación' },
    ],
  },
  {
    rotulo: 'Fiscalización',
    nota: 'Detección y actas',
    clave: 'fisc',
    trazos: [
      'M9.5 4.5H8A1.5 1.5 0 0 0 6.5 6v13A1.5 1.5 0 0 0 8 20.5h8a1.5 1.5 0 0 0 1.5-1.5V6A1.5 1.5 0 0 0 16 4.5h-1.5',
      'M9.5 3.2h5v2.8h-5z',
      'M9.6 13.2l2 2 3.4-4',
    ],
    submodulos: [
      { clave: 'fis-panel', rotulo: 'Panel' },
      { clave: 'fis-actas', rotulo: 'Actas' },
      { clave: 'fis-prog', rotulo: 'Programas y cruces' },
      { clave: 'fis-res', rotulo: 'Resultados' },
    ],
  },
  {
    rotulo: 'Tránsito',
    nota: 'Papeletas y vehículos',
    clave: 'transito',
    trazos: [
      'M5 15.8v-3.2l1.9-4.4h10.2l1.9 4.4v3.2',
      'M3.6 15.8h16.8',
      'M8.4 18.4a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0',
      'M18.8 18.4a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0',
    ],
    submodulos: [
      { clave: 'tra-panel', rotulo: 'Panel' },
      { clave: 'tra-pap', rotulo: 'Papeletas' },
      { clave: 'tra-veh', rotulo: 'Vehículos y depósito' },
      { clave: 'tra-cua', rotulo: 'Cuadros y plazos' },
    ],
  },
  {
    rotulo: 'Infracciones administrativas',
    nota: 'Sanciones administrativas',
    clave: 'infra',
    trazos: ['M12 4.2 20.8 19.6H3.2z', 'M12 9.8v4.4', 'M12 17.1h.02'],
    submodulos: [
      { clave: 'inf-panel', rotulo: 'Panel' },
      { clave: 'inf-exp', rotulo: 'Expedientes' },
      { clave: 'inf-cuis', rotulo: 'CUIS y reincidencia' },
      { clave: 'inf-esc', rotulo: 'Escalas y plazos' },
    ],
  },
  {
    rotulo: 'Consultas',
    nota: 'Ventanilla y constancias',
    clave: 'consultas',
    trazos: ['M17.4 11a6.4 6.4 0 1 1-12.8 0 6.4 6.4 0 0 1 12.8 0', 'M15.8 15.8 20.6 20.6'],
    submodulos: [
      { clave: 'con-panel', rotulo: 'Panel' },
      { clave: 'con-contrib', rotulo: 'Contribuyentes' },
      { clave: 'con-obj', rotulo: 'Consultas por objeto' },
      { clave: 'con-doc', rotulo: 'Documentos y beneficios' },
    ],
  },
  {
    rotulo: 'Valores',
    nota: 'Emisión y notificación',
    clave: 'valores-mod',
    trazos: [
      'M6.5 3.5h7.5l4 4v13h-11.5z',
      'M14 3.5v4h4',
      'M9.5 11.5h5',
      'M15.6 16.4a2.3 2.3 0 1 1-4.6 0 2.3 2.3 0 0 1 4.6 0',
    ],
    submodulos: [
      { clave: 'val-panel', rotulo: 'Panel' },
      { clave: 'val-val', rotulo: 'Valores' },
      { clave: 'val-cart', rotulo: 'Cartera y lotes' },
      { clave: 'val-tip', rotulo: 'Tipos y prescripción' },
    ],
  },
  {
    rotulo: 'Coactiva',
    nota: 'Expedientes y medidas',
    clave: 'coactiva',
    trazos: [
      'M12 4.4v3.2',
      'M5 8.6h14',
      'M5 8.6 2.8 14.4h4.4z',
      'M19 8.6 16.8 14.4h4.4z',
      'M8.4 20h7.2',
    ],
    submodulos: [
      { clave: 'coa-panel', rotulo: 'Panel' },
      { clave: 'coa-exp', rotulo: 'Expedientes' },
      { clave: 'coa-cart', rotulo: 'Cartera y medidas' },
      { clave: 'coa-cost', rotulo: 'Costas y plazos' },
    ],
  },
  {
    rotulo: 'Autorizaciones y licencias',
    nota: 'Licencias y anuncios',
    clave: 'autoriz',
    trazos: ['M4.4 9.6V20h15.2V9.6', 'M3.2 9.6 5.2 4.6h13.6l2 5z', 'M9.6 20v-5.4h4.8V20'],
    submodulos: [
      { clave: 'aut-panel', rotulo: 'Panel' },
      { clave: 'aut-sol', rotulo: 'Solicitudes' },
      { clave: 'aut-cat', rotulo: 'Catálogos y padrones' },
      { clave: 'aut-tram', rotulo: 'Trámites y plazos' },
    ],
  },
  {
    rotulo: 'Seguridad',
    nota: 'Usuarios y permisos',
    clave: 'seguridad',
    trazos: [
      'M12 3.4 19 5.9v5.6c0 4.1-3 7.2-7 9.1-4-1.9-7-5-7-9.1V5.9z',
      'M9.4 12.1l1.9 1.9 3.5-3.6',
    ],
    submodulos: [
      { clave: 'seg-panel', rotulo: 'Panel' },
      { clave: 'seg-acc', rotulo: 'Accesos' },
      { clave: 'seg-aud', rotulo: 'Auditoría' },
      { clave: 'seg-sis', rotulo: 'Sistema' },
    ],
  },
];

/** Una seccion del modulo propio, con el slug que va al hash. */
export interface Seccion {
  readonly clave: string;
  readonly rotulo: string;
  /** Lo que se escribe en el hash. `nor-ediciones` se enlaza como `#ediciones`. */
  readonly slug: string;
  /** Los `<path>` de su icono en la pestana, de `const ICO_SEC`. */
  readonly trazos: readonly string[];
}

/**
 * Las cuatro secciones del modulo propio, de `const SECS`.
 *
 * El artboard lleva en cada fila un tercer campo con el conteo que dibuja al lado del
 * rotulo —`'3'` en «Cuadros de valuación»—. **Aqui no esta**: es un dato, y los datos son
 * de otro issue. Copiarlo habria dejado una cifra en la interfaz sin nada que la respalde,
 * que en el repositorio que existe para que ninguna cifra viva fuera del corpus seria la
 * peor manera de empezar.
 */
export const SECCIONES: readonly Seccion[] = [
  {
    clave: 'nor-panel',
    rotulo: 'Panel',
    slug: 'panel',
    trazos: ['M4 19.5h16', 'M6.5 19.5V9', 'M11 19.5V5.5', 'M15.5 19.5v-7', 'M20 19.5v-11'],
  },
  {
    clave: 'nor-ediciones',
    rotulo: 'Ediciones',
    slug: 'ediciones',
    trazos: [
      'M12 3.6 20.4 8 12 12.4 3.6 8z',
      'M3.6 12 12 16.4 20.4 12',
      'M3.6 16 12 20.4 20.4 16',
    ],
  },
  {
    clave: 'nor-cuadros',
    rotulo: 'Cuadros de valuación',
    slug: 'cuadros',
    trazos: ['M4 5.5h16v13H4z', 'M4 10h16', 'M9.5 10v8.5', 'M15 10v8.5'],
  },
  {
    clave: 'nor-publicacion',
    rotulo: 'Publicación',
    slug: 'publicacion',
    trazos: ['M12 4.5v10', 'M8 11l4 4 4-4', 'M4.5 18.5h15'],
  },
];

/** Lo que se sabe de una hoja mirando solo su clave. */
export interface Hoja {
  readonly modulo: string;
  readonly nota: string;
  readonly rotulo: string;
  readonly trazos: readonly string[];
}

/**
 * Indice plano de clave -> hoja, como el `HOJAS` del artboard.
 *
 * Los trazos que guarda son los del MODULO, que es lo que la ficha ajena y la pestana
 * dibujan; una hoja propia los sobrescribe con los suyos, porque para las cuatro secciones
 * el artboard si tiene icono propio (`ICO_SEC`).
 */
export const HOJAS: ReadonlyMap<string, Hoja> = new Map(
  ARBOL.flatMap((modulo) =>
    modulo.submodulos.map((submodulo): [string, Hoja] => {
      const propia = SECCIONES.find((seccion) => seccion.clave === submodulo.clave);
      return [
        submodulo.clave,
        {
          modulo: modulo.rotulo,
          nota: modulo.nota,
          rotulo: submodulo.rotulo,
          trazos: propia === undefined ? modulo.trazos : propia.trazos,
        },
      ];
    }),
  ),
);

/** Si la clave es una de las cuatro secciones de este sistema. */
export function esPropia(clave: string): boolean {
  return SECCIONES.some((seccion) => seccion.clave === clave);
}
