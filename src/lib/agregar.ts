/**
 * "Agregar a la cotización" de la Calculadora (sección 7, pasos 3 a 6): pone el renglón
 * de resumen en la Parte escogida, suma los materiales y (mano de obra) pone el monto.
 */
import { cantidadNumero, romano } from './cotizacion.ts';
import type { Resultado } from './calculadoras.ts';
import type { DatosCotizacion, Material } from './tipos.ts';

export interface OpcionesAgregar {
  /** Número de la Parte (0, 1, 2…) o el nombre de una Parte nueva. */
  parte: number | { nueva: string };
  clienteVe: boolean;
  /** Si la Parte ya tenía monto: sumarle el nuevo o reemplazarlo. */
  monto: 'sumar' | 'reemplazar';
}

export interface Resumen {
  parte: string;
  renglon: string;
  nuevos: string[];
  sumados: string[];
  monto: number | null;
}

/** "PARTE II · Techo" (o "Parte sin nombre"). */
export function nombreParte(d: DatosCotizacion, i: number): string {
  const p = d.partes[i];
  if (!p?.nombre.trim()) return 'Parte sin nombre';
  const n = d.partes.slice(0, i + 1).filter((x) => x.nombre.trim()).length;
  return `PARTE ${romano(n)} · ${p.nombre.trim()}`;
}

export function agregarACotizacion(d: DatosCotizacion, r: Resultado, o: OpcionesAgregar, catalogo: Material[]): Resumen {
  // 1. La Parte.
  let i: number;
  if (typeof o.parte === 'number' && d.partes[o.parte]) i = o.parte;
  else {
    const nombre = typeof o.parte === 'object' ? o.parte.nueva.trim() : '';
    d.partes.push({ nombre, monto: null, renglones: [] });
    i = d.partes.length - 1;
  }
  const parte = d.partes[i];

  // 2. El renglón de resumen, en el primer renglón libre.
  const libre = parte.renglones.findIndex((x) => !x.texto.trim());
  if (libre >= 0) parte.renglones[libre] = { texto: r.renglon, clienteVe: o.clienteVe };
  else parte.renglones.push({ texto: r.renglon, clienteVe: o.clienteVe });

  // 3. Materiales: si ya está en la lista, se suma la cantidad.
  const enCatalogo = new Set(catalogo.map((m) => m.material.toLowerCase()));
  const nuevos: string[] = [];
  const sumados: string[] = [];
  for (const m of r.materiales) {
    if (!m.agregar || !(m.cantidad > 0)) continue;
    const ya = d.materiales.find((x) => x.material.trim().toLowerCase() === m.material.toLowerCase());
    if (ya) {
      const antes = cantidadNumero(ya.cantidad);
      ya.cantidad = Math.round(((antes ?? 0) + m.cantidad) * 100) / 100;
      sumados.push(m.material);
    } else {
      d.materiales.push({
        material: m.material,
        cantidad: m.cantidad,
        // Si está en el Catálogo se deja vacía para usar la unidad del Catálogo.
        unidad: enCatalogo.has(m.material.toLowerCase()) ? '' : m.unidad,
        precioEspecial: null,
        clienteVe: o.clienteVe,
      });
      nuevos.push(m.material);
    }
  }

  // 4. Mano de obra: el monto va a la Parte y la cotización pasa a "Partes + materiales".
  let monto: number | null = null;
  if (r.monto !== undefined) {
    monto = o.monto === 'sumar' && parte.monto !== null ? parte.monto + r.monto : r.monto;
    parte.monto = monto;
    d.modoPrecio = 'Partes + materiales';
    if (!o.clienteVe) d.clienteVe.montoPartes = false;
  }

  return { parte: nombreParte(d, i), renglon: r.renglon, nuevos, sumados, monto };
}
