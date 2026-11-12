/**
 * Reglas de la contabilidad (sección 10 de la especificación): pagos de clientes,
 * planilla y resúmenes. Solo cuentas, sin pantallas: así se prueban solas.
 */
import { ESTADOS_ACEPTADOS, ultimaVersion } from './cotizacion.ts';
import type { Cotizacion, Hora, Movimiento } from './tipos.ts';

export const CATEGORIA_PLANILLA = 'Planilla (pago a trabajadores)';

const redondo = (x: number) => Math.round(x);
const mesDe = (fecha: string) => fecha.slice(0, 7); // "2026-11"

/** Lo que ya pagó el cliente por una obra (suma de ingresos de esa cotización). */
export function cobrado(numero: string, movimientos: Movimiento[]): number {
  return movimientos.filter((m) => m.tipo === 'Ingreso' && m.cotizacion === numero).reduce((s, m) => s + m.monto, 0);
}

export function gastosDeObra(numero: string, movimientos: Movimiento[]): number {
  return movimientos.filter((m) => m.tipo === 'Gasto' && m.cotizacion === numero).reduce((s, m) => s + m.monto, 0);
}

/** Total, ya pagó, le falta y cuánto sugerir: el adelanto si no ha pagado nada, si no lo pendiente. */
export function infoPago(c: Cotizacion, movimientos: Movimiento[]) {
  const v = ultimaVersion(c);
  const total = v.total;
  const pagado = cobrado(c.numero, movimientos);
  const pendiente = Math.max(0, total - pagado);
  const sugerido = pagado === 0 ? Math.min(v.adelanto, total) : pendiente;
  return { total, pagado, pendiente, sugerido, adelanto: v.adelanto };
}

/** "Saldo final" si cubre lo pendiente; "Adelanto" si es el primer pago; si no, "Abono". */
export function categoriaPago(monto: number, pagado: number, pendiente: number): string {
  if (monto >= pendiente) return 'Saldo final';
  if (pagado === 0) return 'Adelanto';
  return 'Abono';
}

/** Estado de la cotización después del pago: "Pagada" si quedó en 0; "Aceptada" si estaba "Pendiente". */
export function estadoTrasPago(estadoActual: string, pendienteDespues: number): string {
  if (pendienteDespues <= 0) return 'Pagada';
  if (estadoActual === 'Pendiente') return 'Aceptada';
  return estadoActual;
}

// ---------------------------------------------------------------------------
// Planilla
// ---------------------------------------------------------------------------

export const totalHora = (h: Hora) => redondo(h.horas * h.valorHora);

export function resumenTrabajador(nombre: string, horas: Hora[]) {
  const suyas = horas.filter((h) => h.trabajador === nombre);
  const sinPagar = suyas.filter((h) => !h.pagado);
  return {
    horasSinPagar: Math.round(sinPagar.reduce((s, h) => s + h.horas, 0) * 100) / 100,
    montoSinPagar: sinPagar.reduce((s, h) => s + totalHora(h), 0),
    totalPagado: suyas.filter((h) => h.pagado).reduce((s, h) => s + totalHora(h), 0),
  };
}

/** Horas sin pagar de un trabajador, agrupadas por obra (para "Pagar planilla"). */
export function horasPorObra(nombre: string, horas: Hora[]) {
  const grupos = new Map<string, { cotizacion: string; horas: number; monto: number; ids: string[] }>();
  for (const h of horas) {
    if (h.trabajador !== nombre || h.pagado) continue;
    const g = grupos.get(h.cotizacion) ?? { cotizacion: h.cotizacion, horas: 0, monto: 0, ids: [] };
    g.horas = Math.round((g.horas + h.horas) * 100) / 100;
    g.monto += totalHora(h);
    g.ids.push(h.id);
    grupos.set(h.cotizacion, g);
  }
  return [...grupos.values()];
}

export function planillaSinPagar(horas: Hora[]): number {
  return horas.filter((h) => !h.pagado).reduce((s, h) => s + totalHora(h), 0);
}

// ---------------------------------------------------------------------------
// Resúmenes
// ---------------------------------------------------------------------------

export function totales(movs: Movimiento[]) {
  const ingresos = movs.filter((m) => m.tipo === 'Ingreso').reduce((s, m) => s + m.monto, 0);
  const gastos = movs.filter((m) => m.tipo === 'Gasto').reduce((s, m) => s + m.monto, 0);
  return { ingresos, gastos, balance: ingresos - gastos };
}

/** Lo que deben los clientes: solo obras aceptadas o en curso; nunca negativo. */
export function teDeben(cotizaciones: Cotizacion[], movimientos: Movimiento[]): number {
  return cotizaciones
    .filter((c) => ESTADOS_ACEPTADOS.includes(c.estado))
    .reduce((s, c) => s + Math.max(0, ultimaVersion(c).total - cobrado(c.numero, movimientos)), 0);
}

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** Ingresos, gastos, ganancia y margen de cada mes del año. */
export function resumenAnual(anio: number, movimientos: Movimiento[]) {
  const meses = MESES.map((nombre, i) => {
    const clave = `${anio}-${String(i + 1).padStart(2, '0')}`;
    const t = totales(movimientos.filter((m) => mesDe(m.fecha) === clave));
    return { nombre, mes: i + 1, ingresos: t.ingresos, gastos: t.gastos, ganancia: t.balance, margen: t.ingresos > 0 ? t.balance / t.ingresos : null };
  });
  const t = totales(movimientos.filter((m) => m.fecha.startsWith(`${anio}-`)));
  return { meses, total: { ingresos: t.ingresos, gastos: t.gastos, ganancia: t.balance, margen: t.ingresos > 0 ? t.balance / t.ingresos : null } };
}

export function gastosPorCategoria(anio: number, mes: number, movimientos: Movimiento[]) {
  const claveMes = `${anio}-${String(mes).padStart(2, '0')}`;
  const delAnio = movimientos.filter((m) => m.tipo === 'Gasto' && m.fecha.startsWith(`${anio}-`));
  const totalAnio = delAnio.reduce((s, m) => s + m.monto, 0);
  const cats = new Map<string, { categoria: string; mes: number; anio: number }>();
  for (const m of delAnio) {
    const c = cats.get(m.categoria || 'Sin categoría') ?? { categoria: m.categoria || 'Sin categoría', mes: 0, anio: 0 };
    c.anio += m.monto;
    if (mesDe(m.fecha) === claveMes) c.mes += m.monto;
    cats.set(c.categoria, c);
  }
  return [...cats.values()].map((c) => ({ ...c, porcentaje: totalAnio > 0 ? c.anio / totalAnio : 0 })).sort((a, b) => b.anio - a.anio);
}

/** Por obra: cotizado, cobrado, lo que debe, gastos, ganancia y planilla sin pagar. */
export function porObra(cotizaciones: Cotizacion[], movimientos: Movimiento[], horas: Hora[]) {
  return cotizaciones
    .map((c) => {
      const total = ultimaVersion(c).total;
      const cob = cobrado(c.numero, movimientos);
      const gastos = gastosDeObra(c.numero, movimientos);
      return {
        numero: c.numero,
        cliente: c.cliente,
        estado: c.estado,
        total,
        cobrado: cob,
        debe: ESTADOS_ACEPTADOS.includes(c.estado) ? Math.max(0, total - cob) : 0,
        gastos,
        ganancia: cob - gastos,
        planilla: horas.filter((h) => h.cotizacion === c.numero && !h.pagado).reduce((s, h) => s + totalHora(h), 0),
      };
    })
    .filter((o) => o.cobrado || o.gastos || o.planilla || ESTADOS_ACEPTADOS.includes(o.estado))
    .sort((a, b) => b.numero.localeCompare(a.numero, 'es', { numeric: true }));
}
