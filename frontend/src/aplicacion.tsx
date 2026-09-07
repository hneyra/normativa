/**
 * El casco de `normativa-web`.
 *
 * F-1 levanta el andamiaje y **ninguna pantalla**: lo que se monta aqui es el minimo que
 * hace falta para que `yarn build` produzca un bundle y para que la prueba de Testing
 * Library tenga algo que buscar por su rol. Los tokens del sistema de diseno entran en
 * #11, el marco en #12 y los datos en #13, todos por encima de las barreras que este
 * issue deja puestas.
 *
 * Aqui no hay una sola cifra escrita, y es la regla 5 del repositorio antes que una
 * casualidad: lo que este sistema publica se pide al conjunto sellado del ejercicio.
 */
export function Aplicacion() {
  return (
    <main>
      <h1>Normativa</h1>
      <p>
        Parámetros versionados y sellados por ejercicio, el corpus normativo verificado a doble
        firma, las tres tablas de valuación nacionales y el catálogo de reglas.
      </p>
    </main>
  );
}
