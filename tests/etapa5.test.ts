import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalizarCotizaciones } from '../src/lib/cotizacion.ts';
import { normalizarHoras, normalizarMovimientos } from '../src/lib/normalizar.ts';
import {
  categoriaPago,
  cobrado,
  estadoTrasPago,
  gastosPorCategoria,
  horasPorObra,
  infoPago,
  planillaSinPagar,
  porObra,
  resumenAnual,
  resumenTrabajador,
  teDeben,
  totales,
} from '../src/lib/contabilidad.ts';
import type { Hora, Movimiento } from '../src/lib/tipos.ts';

const cotizaciones = normalizarCotizaciones(JSON.parse(readFileSync('datos_iniciales/cotizaciones.json', 'utf8')));
const joseph = cotizaciones.find((c) => c.numero === 'COT-0006')!; // ₡240,000, adelanto ₡120,000

let n = 0;
const mov = (m: Partial<Movimiento>): Movimiento => ({
  id: 'm' + n++, fecha: '2026-11-05', tipo: 'Ingreso', categoria: '', descripcion: '', cotizacion: '', persona: '', metodo: 'SINPE Móvil',
  monto: 0, comprobante: '', notas: '', registradoPor: 'Pablo', registrado: '', ...m,
});
const hora = (h: Partial<Hora>): Hora => ({
  id: 'h' + n++, fecha: '2026-11-05', trabajador: 'Carlos', cotizacion: 'COT-0006', horas: 8, valorHora: 2500, pagado: false, fechaPago: '',
  notas: '', registradoPor: 'Lin', registrado: '', ...h,
});

describe('pago de un cliente', () => {
  it('sin pagos: sugiere el adelanto', () => {
    expect(infoPago(joseph, [])).toMatchObject({ total: 240000, pagado: 0, pendiente: 240000, sugerido: 120000 });
  });
  it('con un pago: sugiere lo pendiente', () => {
    const movs = [mov({ cotizacion: 'COT-0006', monto: 120000 })];
    expect(infoPago(joseph, movs)).toMatchObject({ pagado: 120000, pendiente: 120000, sugerido: 120000 });
  });
  it('categoría automática', () => {
    expect(categoriaPago(120000, 0, 240000)).toBe('Adelanto');
    expect(categoriaPago(50000, 120000, 120000)).toBe('Abono');
    expect(categoriaPago(120000, 120000, 120000)).toBe('Saldo final');
    expect(categoriaPago(240000, 0, 240000)).toBe('Saldo final'); // paga todo de una vez
  });
  it('estado después del pago', () => {
    expect(estadoTrasPago('Pendiente', 120000)).toBe('Aceptada');
    expect(estadoTrasPago('En proceso', 50000)).toBe('En proceso');
    expect(estadoTrasPago('Terminada', 0)).toBe('Pagada');
  });
  it('los gastos de la obra no cuentan como cobrado', () => {
    expect(cobrado('COT-0006', [mov({ cotizacion: 'COT-0006', monto: 1000 }), mov({ tipo: 'Gasto', cotizacion: 'COT-0006', monto: 500 })])).toBe(1000);
  });
});

describe('planilla', () => {
  const horas = [
    hora({ horas: 8 }),
    hora({ horas: 4.5, cotizacion: 'COT-0005' }),
    hora({ horas: 8, pagado: true, fechaPago: '2026-11-01' }),
    hora({ trabajador: 'Ana', horas: 10, valorHora: 3000 }),
  ];
  it('resumen por trabajador (acepta horas con decimales)', () => {
    expect(resumenTrabajador('Carlos', horas)).toEqual({ horasSinPagar: 12.5, montoSinPagar: 31250, totalPagado: 20000 });
  });
  it('agrupa lo que se debe por obra', () => {
    const g = horasPorObra('Carlos', horas);
    expect(g.map((x) => [x.cotizacion, x.horas, x.monto])).toEqual([['COT-0006', 8, 20000], ['COT-0005', 4.5, 11250]]);
  });
  it('planilla sin pagar de todos', () => {
    expect(planillaSinPagar(horas)).toBe(31250 + 30000);
  });
});

describe('resúmenes', () => {
  const movs = [
    mov({ fecha: '2026-10-10', monto: 120000, cotizacion: 'COT-0006' }),
    mov({ fecha: '2026-11-02', monto: 50000, cotizacion: 'COT-0006' }),
    mov({ fecha: '2026-11-03', tipo: 'Gasto', categoria: 'Materiales', monto: 30000, cotizacion: 'COT-0006' }),
    mov({ fecha: '2026-11-04', tipo: 'Gasto', categoria: 'Combustible', monto: 10000 }),
    mov({ fecha: '2026-10-04', tipo: 'Gasto', categoria: 'Materiales', monto: 20000 }),
    mov({ fecha: '2025-12-31', monto: 999999 }),
  ];

  it('totales', () => {
    expect(totales(movs.slice(0, 4))).toEqual({ ingresos: 170000, gastos: 40000, balance: 130000 });
  });
  it('resumen del año por mes con margen', () => {
    const r = resumenAnual(2026, movs);
    expect(r.meses[10]).toMatchObject({ nombre: 'Noviembre', ingresos: 50000, gastos: 40000, ganancia: 10000, margen: 0.2 });
    expect(r.meses[0].margen).toBeNull();
    expect(r.total).toMatchObject({ ingresos: 170000, gastos: 60000, ganancia: 110000 });
  });
  it('gastos por categoría: mes, año y % del año', () => {
    expect(gastosPorCategoria(2026, 11, movs)).toEqual([
      { categoria: 'Materiales', mes: 30000, anio: 50000, porcentaje: 50000 / 60000 },
      { categoria: 'Combustible', mes: 10000, anio: 10000, porcentaje: 10000 / 60000 },
    ]);
  });
  it('"te deben" solo cuenta obras aceptadas o en curso', () => {
    const copia = structuredClone(cotizaciones);
    copia.find((c) => c.numero === 'COT-0006')!.estado = 'En proceso';
    copia.find((c) => c.numero === 'COT-0007')!.estado = 'Rechazada';
    expect(teDeben(copia, movs)).toBe(240000 - 170000);
  });
  it('por obra', () => {
    const copia = structuredClone(cotizaciones);
    copia.find((c) => c.numero === 'COT-0006')!.estado = 'En proceso';
    const o = porObra(copia, movs, [hora({ horas: 2 })]).find((x) => x.numero === 'COT-0006')!;
    expect(o).toMatchObject({ total: 240000, cobrado: 170000, debe: 70000, gastos: 30000, ganancia: 140000, planilla: 5000 });
  });
});

describe('datos guardados', () => {
  it('movimientos y horas: montos siempre positivos y datos raros se descartan', () => {
    const m = normalizarMovimientos([{ id: 'a', fecha: '2026-11-01', tipo: 'Gasto', monto: -500 }, { tipo: 'Otro', monto: 1 }, null]);
    expect(m).toHaveLength(1);
    expect(m[0].monto).toBe(500);
    expect(normalizarHoras([{ trabajador: 'Carlos', horas: 2.5, valorHora: 2000, pagado: true }])[0]).toMatchObject({ horas: 2.5, pagado: true });
  });
});
