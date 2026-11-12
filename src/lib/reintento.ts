import { ErrorConflicto, type RepoDatos } from './github.ts';

export interface Leido<T> {
  datos: T;
  sha: string | null;
}

/**
 * Aplica un cambio a un archivo JSON y lo guarda. Si el otro usuario guardó
 * primero (conflicto), vuelve a leer lo último y aplica el MISMO cambio encima,
 * para que no se pierda lo que hizo ninguno de los dos.
 */
export async function guardarConReintento<T>(
  repo: Pick<RepoDatos, 'leerJson' | 'escribirJson'>,
  ruta: string,
  actual: Leido<T>,
  cambio: (copia: T) => T | void,
  mensaje: string,
  normalizar: (crudo: unknown) => T,
  intentos = 4,
): Promise<Leido<T>> {
  let base = actual;
  for (let i = 0; i < intentos; i++) {
    const copia = structuredClone(base.datos);
    const nuevo = normalizar(cambio(copia) ?? copia);
    try {
      const sha = await repo.escribirJson(ruta, nuevo, base.sha, mensaje);
      return { datos: nuevo, sha };
    } catch (e) {
      if (!(e instanceof ErrorConflicto) || i === intentos - 1) throw e;
      const fresco = await repo.leerJson<unknown>(ruta);
      base = fresco ? { datos: normalizar(fresco.datos), sha: fresco.sha } : { datos: normalizar(null), sha: null };
    }
  }
  throw new ErrorConflicto();
}
