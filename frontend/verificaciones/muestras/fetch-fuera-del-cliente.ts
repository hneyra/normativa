// Viola: las peticiones pasan por «solicitar» de `src/api`, no por un `fetch` suelto.
//
// Este `fetch` no lleva token, no compara el `ETag` del snapshot y no sabe leer el
// `problem+json` del backend. Funciona en desarrollo, donde no hay ni token ni errores, y
// se descubre en la municipalidad — con un conjunto sellado que nadie verifico.
export async function traerConjuntoSellado() {
  const respuesta = await fetch('/normativa/api/v1/conjuntos/2026');
  return respuesta.json();
}
