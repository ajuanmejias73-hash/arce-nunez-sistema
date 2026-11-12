/**
 * Quién está usando el sistema (Pablo o Lin). El PIN solo identifica a la persona;
 * la protección real de los datos es el token de GitHub de este dispositivo.
 */
import type { Usuario } from './tipos.ts';
import { borrarLocal, escribirLocal, leerLocal } from './guardado.ts';

const CLAVE = 'arce.pin';

class Sesion {
  usuario = $state<string | null>(null);

  /** Entra con el PIN. Devuelve false si no coincide con nadie. */
  entrar(pin: string, usuarios: Usuario[]): boolean {
    const u = usuarios.find((x) => x.pin === pin);
    if (!u) return false;
    this.usuario = u.nombre;
    escribirLocal(CLAVE, pin);
    return true;
  }

  /** Al abrir la página: si el PIN recordado sigue siendo válido, entra solo. */
  restaurar(usuarios: Usuario[]): void {
    const pin = leerLocal<string>(CLAVE);
    const u = pin ? usuarios.find((x) => x.pin === pin) : undefined;
    this.usuario = u?.nombre ?? null;
    if (!u) borrarLocal(CLAVE);
  }

  /** Si cambiaron el nombre o el PIN en Ajustes, mantener la sesión al día. */
  actualizar(usuarios: Usuario[]): void {
    if (this.usuario) this.restaurar(usuarios);
  }

  salir(): void {
    this.usuario = null;
    borrarLocal(CLAVE);
  }

  /** Nombre para firmar los cambios. */
  get quien(): string {
    return this.usuario ?? 'Desconocido';
  }
}

export const sesion = new Sesion();
