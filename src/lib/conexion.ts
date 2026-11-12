/** Conexión de ESTE dispositivo con el repositorio privado de datos (se guarda solo en este navegador). */
import type { Conexion } from './github.ts';
import { borrarLocal, escribirLocal, leerLocal } from './guardado.ts';

const CLAVE = 'arce.conexion';

/** Datos de prueba en esta compu (solo existe mientras se desarrolla, nunca en la página publicada). */
export const MODO_PRUEBA_DISPONIBLE = import.meta.env.DEV;

export const CONEXION_PRUEBA: Conexion = { base: '/__github', owner: 'local', repo: 'datos', token: 'prueba' };

export function conexionGuardada(): Conexion | null {
  const c = leerLocal<Conexion>(CLAVE);
  if (!c || !c.owner || !c.repo || !c.token) return null;
  if (c.base !== 'https://api.github.com' && !(MODO_PRUEBA_DISPONIBLE && c.base === CONEXION_PRUEBA.base)) return null;
  return c;
}

export function guardarConexion(c: Conexion): void {
  escribirLocal(CLAVE, c);
}

export function olvidarConexion(): void {
  borrarLocal(CLAVE);
}

export function esPrueba(c: Conexion | null): boolean {
  return c?.base === CONEXION_PRUEBA.base;
}
