/** Clientes y proveedores: fichas, cotizaciones y plata de cada uno. Solo cuentas. */
import { cobrado } from './contabilidad.ts';
import { ESTADOS_ACEPTADOS, ultimaVersion } from './cotizacion.ts';
import type { Cliente, Cotizacion, Movimiento, Proveedor } from './tipos.ts';

export const claveNombre = (s: string) => s.trim().toLowerCase();

export interface ResumenCliente {
  nombre: string;
  /** null = todavía no tiene ficha (solo sale en cotizaciones). */
  ficha: Cliente | null;
  telefono: string;
  ubicacion: string;
  correo: string;
  cedula: string;
  notas: string;
  cotizaciones: Cotizacion[];
  /** Suma de lo cotizado en las aceptadas (o en proceso, terminadas, pagadas). */
  aceptado: number;
  pagado: number;
  debe: number;
  /** Fecha de la cotización más reciente ('' si no tiene). */
  ultima: string;
}

/** Todos los clientes: los que tienen ficha y los que solo salen en cotizaciones. */
export function listaClientes(fichas: Cliente[], cotizaciones: Cotizacion[], movimientos: Movimiento[]): ResumenCliente[] {
  const mapa = new Map<string, ResumenCliente>();
  const nuevo = (nombre: string): ResumenCliente => ({
    nombre,
    ficha: null,
    telefono: '',
    ubicacion: '',
    correo: '',
    cedula: '',
    notas: '',
    cotizaciones: [],
    aceptado: 0,
    pagado: 0,
    debe: 0,
    ultima: '',
  });
  // Cotizaciones: de la más vieja a la más nueva, para quedarse con los datos más recientes.
  const ordenadas = [...cotizaciones].sort((a, b) => ultimaVersion(a).datos.fecha.localeCompare(ultimaVersion(b).datos.fecha));
  for (const c of ordenadas) {
    const d = ultimaVersion(c).datos;
    const clave = claveNombre(d.cliente);
    if (!clave) continue;
    const r = mapa.get(clave) ?? nuevo(d.cliente.trim());
    r.cotizaciones.push(c);
    r.telefono = d.telefono || r.telefono;
    r.ubicacion = d.ubicacion || r.ubicacion;
    r.ultima = d.fecha;
    mapa.set(clave, r);
  }
  // La ficha manda sobre lo que dicen las cotizaciones.
  for (const f of fichas) {
    const clave = claveNombre(f.nombre);
    const r = mapa.get(clave) ?? nuevo(f.nombre);
    Object.assign(r, {
      nombre: f.nombre,
      ficha: f,
      telefono: f.telefono || r.telefono,
      ubicacion: f.ubicacion || r.ubicacion,
      correo: f.correo,
      cedula: f.cedula,
      notas: f.notas,
    });
    mapa.set(clave, r);
  }
  for (const [clave, r] of mapa) {
    r.cotizaciones.reverse(); // la más nueva primero
    r.pagado =
      r.cotizaciones.reduce((s, c) => s + cobrado(c.numero, movimientos), 0) +
      // Pagos sin cotización pero a nombre del cliente.
      movimientos.filter((m) => m.tipo === 'Ingreso' && !m.cotizacion && claveNombre(m.persona) === clave).reduce((s, m) => s + m.monto, 0);
    const aceptadas = r.cotizaciones.filter((c) => ESTADOS_ACEPTADOS.includes(c.estado));
    r.aceptado = aceptadas.reduce((s, c) => s + ultimaVersion(c).total, 0);
    r.debe = aceptadas.reduce((s, c) => s + Math.max(0, ultimaVersion(c).total - cobrado(c.numero, movimientos)), 0);
  }
  return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** Número para WhatsApp: solo dígitos, con 506 si es un número de Costa Rica de 8 dígitos. */
export function numeroWhatsApp(telefono: string): string {
  const d = telefono.replace(/\D/g, '');
  return d.length === 8 ? '506' + d : d;
}

/** Cada teléfono de un texto como "8888-8888 / 2222-2222". */
export function telefonos(texto: string): string[] {
  return (texto.match(/\+?\d[\d\s-]{6,}\d/g) ?? []).map((t) => t.trim());
}

export interface ResumenProveedor {
  proveedor: Proveedor;
  /** Lo que se le ha pagado (gastos a su nombre). */
  pagado: number;
  gastos: Movimiento[];
  /** Cotizaciones donde se usó (la última versión). */
  cotizaciones: Cotizacion[];
}

export function resumenProveedor(p: Proveedor, cotizaciones: Cotizacion[], movimientos: Movimiento[]): ResumenProveedor {
  const clave = claveNombre(p.nombre);
  const gastos = movimientos.filter((m) => m.tipo === 'Gasto' && claveNombre(m.persona) === clave).sort((a, b) => b.fecha.localeCompare(a.fecha));
  return {
    proveedor: p,
    pagado: gastos.reduce((s, m) => s + m.monto, 0),
    gastos,
    cotizaciones: cotizaciones.filter((c) => ultimaVersion(c).datos.materiales.some((f) => f.proveedor && claveNombre(f.proveedor) === clave)),
  };
}

/** Si un proveedor ya se usa (en cotizaciones o gastos), no se le cambia el nombre. */
export function proveedorEnUso(nombre: string, cotizaciones: Cotizacion[], movimientos: Movimiento[]): boolean {
  const clave = claveNombre(nombre);
  return (
    movimientos.some((m) => claveNombre(m.persona) === clave) ||
    cotizaciones.some((c) => c.versiones.some((v) => v.datos.materiales.some((f) => f.proveedor && claveNombre(f.proveedor) === clave)))
  );
}
