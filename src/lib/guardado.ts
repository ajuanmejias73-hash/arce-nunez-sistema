/** Acceso seguro al almacenamiento del navegador (puede estar bloqueado en ventanas privadas). */

export function leerLocal<T>(clave: string): T | null {
  try {
    const v = localStorage.getItem(clave);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

export function escribirLocal(clave: string, valor: unknown): void {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin almacenamiento: se pierde al cerrar, pero la página sigue funcionando */
  }
}

export function borrarLocal(clave: string): void {
  try {
    localStorage.removeItem(clave);
  } catch {
    /* nada */
  }
}
