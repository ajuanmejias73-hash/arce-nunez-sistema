/** Guardar pagos, gastos, horas y pagos de planilla (cada uno firmado por quien lo hizo). */
import { CATEGORIA_PLANILLA, categoriaPago, estadoTrasPago, horasPorObra, infoPago } from './contabilidad.ts';
import { datos } from './datos.svelte.ts';
import { colones } from './formato.ts';
import { nuevoId } from './normalizar.ts';
import { sesion } from './sesion.svelte.ts';
import type { Hora, Movimiento } from './tipos.ts';

const firma = () => ({ registradoPor: sesion.quien, registrado: new Date().toISOString() });

export type DatosMovimiento = Omit<Movimiento, 'id' | 'registradoPor' | 'registrado'>;

/** Pago de un cliente: categoría automática y estado de la cotización al día. Devuelve el resumen. */
export async function registrarPago(numero: string, monto: number, metodo: string, fecha: string, comprobante: string, notas: string): Promise<string> {
  const c = datos.c!.cotizaciones.find((x) => x.numero === numero);
  if (!c) throw new Error(`no se encontró ${numero}.`);
  const info = infoPago(c, datos.c!.movimientos);
  const categoria = categoriaPago(monto, info.pagado, info.pendiente);
  const m: Movimiento = {
    id: nuevoId(),
    fecha,
    tipo: 'Ingreso',
    categoria,
    descripcion: `${categoria} de ${c.numero}`,
    cotizacion: c.numero,
    persona: c.cliente,
    metodo,
    monto,
    comprobante,
    notas,
    ...firma(),
  };
  await datos.modificar('movimientos', (l) => void l.push(m), `registró un pago de ${colones(monto)} de ${c.cliente} (${c.numero})`, sesion.quien);

  const quedan = Math.max(0, info.pendiente - monto);
  const nuevo = estadoTrasPago(c.estado, quedan);
  if (nuevo !== c.estado) {
    await datos.modificar(
      'cotizaciones',
      (l) => {
        const x = l.find((y) => y.numero === numero);
        if (x) Object.assign(x, { estado: nuevo, estadoPor: sesion.quien, estadoFecha: new Date().toISOString() });
      },
      `cambió ${numero} a «${nuevo}» (por un pago)`,
      sesion.quien,
    );
  }
  return `${categoria}: ${colones(monto)}. ${quedan > 0 ? `Le falta ${colones(quedan)}.` : 'Quedó todo pagado.'}${nuevo !== c.estado ? ` La cotización pasó a «${nuevo}».` : ''}`;
}

/** Nuevo movimiento (id = null) o cambios a uno existente. */
export async function guardarMovimiento(id: string | null, d: DatosMovimiento): Promise<void> {
  await datos.modificar(
    'movimientos',
    (l) => {
      if (id === null) l.push({ ...d, id: nuevoId(), ...firma() });
      else {
        const i = l.findIndex((m) => m.id === id);
        if (i < 0) throw new Error('ese movimiento ya no existe (¿lo borró la otra persona?).');
        l[i] = { ...l[i], ...d, id, ...firma() };
      }
    },
    `${id === null ? 'registró' : 'editó'} ${d.tipo === 'Gasto' ? 'un gasto' : 'un ingreso'} de ${colones(d.monto)} (${d.categoria})`,
    sesion.quien,
  );
}

/** Borra un movimiento. Si salió de "Pagar planilla", esas horas vuelven a quedar sin pagar. */
export async function borrarMovimiento(m: Movimiento): Promise<void> {
  await datos.modificar('movimientos', (l) => l.filter((x) => x.id !== m.id), `borró ${m.tipo === 'Gasto' ? 'un gasto' : 'un ingreso'} de ${colones(m.monto)} (${m.categoria})`, sesion.quien);
  if (m.pagoPlanilla) {
    await datos.modificar(
      'horas',
      (l) => {
        for (const h of l) {
          if (h.pagoPlanilla === m.pagoPlanilla && h.cotizacion === m.cotizacion) {
            h.pagado = false;
            h.fechaPago = '';
            delete h.pagoPlanilla;
          }
        }
      },
      'volvió a dejar sin pagar las horas de un pago de planilla borrado',
      sesion.quien,
    );
  }
}

/** Registrar horas (y crear el trabajador si es nuevo). */
export async function registrarHoras(
  h: Omit<Hora, 'id' | 'pagado' | 'fechaPago' | 'registradoPor' | 'registrado'>,
  nuevoTrabajador: { puesto: string; valorHora: number; telefono: string } | null,
): Promise<void> {
  if (nuevoTrabajador) {
    await datos.modificar(
      'trabajadores',
      (l) => {
        if (!l.some((t) => t.nombre.toLowerCase() === h.trabajador.toLowerCase())) {
          l.push({ nombre: h.trabajador, puesto: nuevoTrabajador.puesto, valorHora: nuevoTrabajador.valorHora, telefono: nuevoTrabajador.telefono, modificadoPor: sesion.quien, modificado: new Date().toISOString() });
        }
      },
      `agregó al trabajador «${h.trabajador}»`,
      sesion.quien,
    );
  }
  await datos.modificar('horas', (l) => void l.push({ ...h, id: nuevoId(), pagado: false, fechaPago: '', ...firma() }), `registró ${h.horas} horas de ${h.trabajador}`, sesion.quien);
}

export async function borrarHora(h: Hora): Promise<void> {
  if (h.pagado) throw new Error('esas horas ya se pagaron; primero hay que borrar el gasto de planilla.');
  await datos.modificar('horas', (l) => l.filter((x) => x.id !== h.id), `borró ${h.horas} horas de ${h.trabajador}`, sesion.quien);
}

/**
 * Pagar planilla: marca pagadas las horas sin pagar del trabajador y crea un gasto
 * "Planilla" por cada obra. Devuelve cuántos gastos se crearon y el total.
 */
export async function pagarPlanilla(trabajador: string, metodo: string, fecha: string): Promise<{ gastos: number; total: number }> {
  const grupos = horasPorObra(trabajador, datos.c!.horas);
  if (!grupos.length) throw new Error(`${trabajador} no tiene horas sin pagar.`);
  const pago = nuevoId();
  const ids = new Set(grupos.flatMap((g) => g.ids));
  await datos.modificar(
    'horas',
    (l) => {
      for (const h of l) if (ids.has(h.id) && !h.pagado) Object.assign(h, { pagado: true, fechaPago: fecha, pagoPlanilla: pago });
    },
    `pagó la planilla de ${trabajador}`,
    sesion.quien,
  );
  const categoria = datos.c!.ajustes.listas.categoriasGasto.find((c) => c.startsWith('Planilla')) ?? CATEGORIA_PLANILLA;
  try {
    await datos.modificar(
      'movimientos',
      (l) => {
        for (const g of grupos) {
          l.push({
            id: nuevoId(),
            fecha,
            tipo: 'Gasto',
            categoria,
            descripcion: `Planilla de ${trabajador}: ${g.horas} horas`,
            cotizacion: g.cotizacion,
            persona: trabajador,
            metodo,
            monto: g.monto,
            comprobante: '',
            notas: '',
            pagoPlanilla: pago,
            ...firma(),
          });
        }
      },
      `registró el gasto de planilla de ${trabajador}`,
      sesion.quien,
    );
  } catch (e) {
    throw new Error(`las horas quedaron marcadas como pagadas, pero el gasto no se pudo registrar. Registralo a mano en "Pagos y gastos". (${e instanceof Error ? e.message : e})`);
  }
  return { gastos: grupos.length, total: grupos.reduce((s, g) => s + g.monto, 0) };
}
