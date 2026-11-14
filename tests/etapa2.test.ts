import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalizarAjustes, normalizarMateriales } from '../src/lib/normalizar.ts';
import {
  calcular,
  clausulasFinales,
  clientes,
  datosNuevos,
  normalizarCotizaciones,
  normalizarDatos,
  normalizarPartes,
  romano,
  siguienteNumero,
  textoPartes,
  ultimaVersion,
} from '../src/lib/cotizacion.ts';
import { armarVista, nombreArchivo } from '../src/lib/modelo.ts';
import type { DatosCotizacion, Material } from '../src/lib/tipos.ts';

const leer = (f: string) => JSON.parse(readFileSync('datos_iniciales/' + f, 'utf8'));
const ajustes = normalizarAjustes(leer('ajustes.json'));
const catalogo = normalizarMateriales(leer('catalogo_materiales.json'));
const cotizaciones = normalizarCotizaciones(leer('cotizaciones.json'));

function base(cambios: Partial<DatosCotizacion> = {}): DatosCotizacion {
  return { ...datosNuevos(ajustes, 'COT-0100'), cliente: 'Prueba', fecha: '2026-11-11', modoPrecio: 'Total a mano' as const, ...cambios };
}

describe('las 7 cotizaciones viejas', () => {
  it('se cargan todas', () => {
    expect(cotizaciones.map((c) => c.numero)).toEqual(['COT-0001', 'COT-0002', 'COT-0003', 'COT-0004', 'COT-0005', 'COT-0006', 'COT-0007']);
  });

  it('el total y el adelanto calculados coinciden con los del Excel', () => {
    for (const c of cotizaciones) {
      const v = ultimaVersion(c);
      const r = calcular(v.datos, catalogo, ajustes.porDefecto.iva);
      expect(r.total, c.numero).toBe(v.total);
      expect(r.adelanto, c.numero).toBe(v.adelanto);
    }
  });

  it('la Parte I de HQ (4 bloques de continuación) queda como una sola Parte', () => {
    const hq = ultimaVersion(cotizaciones.find((c) => c.numero === 'COT-0003')!).datos;
    expect(hq.partes[0].nombre).toBe('Estructura');
    expect(hq.partes[0].renglones).toHaveLength(10 + 7 + 11 + 7);
    expect(hq.partes).toHaveLength(10);
    expect(hq.partes.every((p) => p.nombre)).toBe(true);
  });

  it('la siguiente es COT-0008', () => {
    expect(siguienteNumero(cotizaciones, 'COT-')).toBe('COT-0008');
  });

  it('lista de clientes sin repetir', () => {
    const l = clientes(cotizaciones);
    expect(l).toHaveLength(7);
    expect(l.map((x) => x.cliente)).toContain('HQ');
  });

  it('cada cotización vieja arma su vista sin errores', () => {
    for (const c of cotizaciones) {
      const { vista } = armarVista(ultimaVersion(c).datos, ajustes, catalogo);
      expect(vista.total).toMatch(/^₡/);
      expect(vista.clausulas.length).toBeGreaterThan(5);
    }
  });
});

describe('cálculos (sección 5)', () => {
  const cat: Material[] = [{ material: 'Cemento (saco)', unidad: 'saco', precio: 7000, categoria: '', notas: '' }];

  it('Total a mano', () => {
    const r = calcular(base({ totalAMano: 240000 }), cat, 0.13);
    expect(r).toMatchObject({ subtotal: 240000, iva: 0, total: 240000, adelanto: 120000, saldo: 120000 });
  });

  it('IVA redondeado y adelanto redondeado', () => {
    const r = calcular(base({ totalAMano: 100001, cobrarIVA: true, porcentajeAdelanto: 0.3 }), cat, 0.13);
    expect(r.iva).toBe(13000); // 13000.13 → 13000
    expect(r.total).toBe(113001);
    expect(r.adelanto).toBe(33900); // 33900.3 → 33900
    expect(r.saldo).toBe(113001 - 33900);
  });

  it('Partes + materiales: los materiales solo suman si Arce Nuñez compra', () => {
    const d = base({
      modoPrecio: 'Partes + materiales',
      partes: [
        { nombre: 'A', monto: 100000, renglones: [] },
        { nombre: 'B', monto: 50000, renglones: [] },
      ],
      materiales: [
        { material: 'Cemento (saco)', cantidad: 10, unidad: '', precioEspecial: null, clienteVe: true },
        { material: 'Arena', cantidad: '2', unidad: 'm³', precioEspecial: 15000, clienteVe: false },
        { material: 'Varilla', cantidad: 'pendiente', unidad: '', precioEspecial: 3000, clienteVe: true },
      ],
    });
    const cliente = calcular(d, cat, 0.13);
    expect(cliente.manoDeObra).toBe(150000);
    expect(cliente.materiales).toBe(70000 + 30000); // el oculto sí cuenta; "pendiente" no
    expect(cliente.subtotal).toBe(150000);
    expect(cliente.filas[0]).toMatchObject({ unidadFinal: 'saco', precioCatalogo: 7000, precioUsado: 7000, total: 70000 });
    expect(cliente.filas[2].total).toBeNull();

    const arce = calcular({ ...d, quienCompraMateriales: 'Arce Nuñez' }, cat, 0.13);
    expect(arce.subtotal).toBe(250000);
  });

  it('válida hasta = fecha + validez', () => {
    expect(calcular(base({ fecha: '2026-11-11', validezDias: 15 }), cat, 0.13).validaHasta).toBe('2026-11-26');
  });
});

describe('partes y romanos', () => {
  it('romanos', () => {
    expect([1, 2, 4, 9, 14].map(romano)).toEqual(['I', 'II', 'IV', 'IX', 'XIV']);
  });
  it('texto de {PARTES}', () => {
    expect(textoPartes(0)).toBe('esta cotización');
    expect(textoPartes(1)).toBe('la Parte I');
    expect(textoPartes(2)).toBe('las Partes I y II');
    expect(textoPartes(5)).toBe('las Partes I a V');
  });
  it('continuación suma montos y quita renglones vacíos', () => {
    const p = normalizarPartes([
      { nombre: 'A', monto: 100, renglones: [{ texto: 'uno' }, { texto: '  ' }] },
      { nombre: '', monto: 50, renglones: [{ texto: 'dos', clienteVe: false }] },
      { nombre: '', monto: null, renglones: [] },
      { nombre: 'B', monto: null, renglones: [] },
    ]);
    expect(p).toEqual([
      { nombre: 'A', monto: 150, renglones: [{ texto: 'uno', clienteVe: true }, { texto: 'dos', clienteVe: false }] },
      { nombre: 'B', monto: null, renglones: [] },
    ]);
  });
});

describe('cláusulas', () => {
  it('palabras automáticas y condiciones', () => {
    const d = base({ totalAMano: 200000, partes: [{ nombre: 'A', monto: null, renglones: [] }, { nombre: 'B', monto: null, renglones: [] }] });
    const c = calcular(d, catalogo, 0.13);
    const t = clausulasFinales(ajustes.clausulas, d, c, ajustes);
    const por = (titulo: string) => t.find((x) => x.titulo === titulo)!.texto;
    expect(por('Alcance de la obra')).toContain('exclusivamente la mano de obra');
    expect(por('Alcance de la obra')).toContain('las Partes I y II');
    expect(por('Forma de pago')).toContain('50% (₡100,000)');
    expect(por('Gestión de materiales')).toMatch(/^El cliente es el único responsable/);
    expect(por('Facturación')).toContain('se sumará el 13%');
    expect(t.some((x) => /\{[A-Z_]+\}/.test(x.texto))).toBe(false);

    const d2 = { ...d, quienCompraMateriales: 'Arce Nuñez' as const, cobrarIVA: true, formaPagoEspecial: 'Pago semanal.' };
    const t2 = clausulasFinales(ajustes.clausulas, d2, calcular(d2, catalogo, 0.13), ajustes);
    const por2 = (titulo: string) => t2.find((x) => x.titulo === titulo)!.texto;
    expect(por2('Alcance de la obra')).toContain('la mano de obra y los materiales');
    expect(por2('Gestión de materiales')).toMatch(/^Esta cotización incluye/);
    expect(por2('Facturación')).toMatch(/^El monto total incluye/);
    expect(por2('Forma de pago')).toBe('Pago semanal.');
  });
});

describe('lo que ve el cliente', () => {
  const d = base({
    modoPrecio: 'Partes + materiales',
    quienCompraMateriales: 'Arce Nuñez',
    partes: [
      { nombre: 'Techo', monto: 100000, renglones: [{ texto: 'Visible', clienteVe: true }, { texto: 'Oculto', clienteVe: false }] },
      { nombre: '', monto: null, renglones: [] },
    ],
    materiales: [
      { material: 'Cemento (saco)', cantidad: 2, unidad: '', precioEspecial: 7000, clienteVe: true },
      { material: 'Secreto', cantidad: 1, unidad: 'unid', precioEspecial: 1000, clienteVe: false },
    ],
  });

  it('lo oculto no sale pero sí cuenta', () => {
    const { vista, calculo } = armarVista(d, ajustes, catalogo);
    expect(vista.partes).toEqual([{ etiqueta: 'PARTE I', nombre: 'Techo', renglones: ['Visible'], monto: '₡100,000' }]);
    expect(vista.materiales!.filas.map((f) => f.material)).toEqual(['Cemento (saco)']);
    expect(calculo.total).toBe(100000 + 15000);
    expect(vista.desglose.map((x) => x.etiqueta)).toEqual(['Mano de obra', 'Materiales', 'Subtotal']);
  });

  it('interruptores apagados', () => {
    const { vista } = armarVista({ ...d, clienteVe: { montoPartes: false, preciosMateriales: false, desglose: false, adelantoSaldo: false } }, ajustes, catalogo);
    expect(vista.mostrarMontos).toBe(false);
    expect(vista.partes[0].monto).toBe('');
    expect(vista.materiales!.conPrecios).toBe(false);
    expect(vista.desglose).toEqual([]);
    expect(vista.adelantoSaldo).toEqual([]);
  });

  it('forma de pago especial oculta adelanto y saldo', () => {
    const { vista } = armarVista({ ...d, formaPagoEspecial: 'Semanal' }, ajustes, catalogo);
    expect(vista.adelantoSaldo).toEqual([]);
    expect(vista.pagos).toContain('Ver «Forma de pago» en las condiciones');
  });

  it('modo Total a mano: sin mano de obra ni precios de materiales', () => {
    const { vista } = armarVista({ ...d, modoPrecio: 'Total a mano', totalAMano: 300000 }, ajustes, catalogo);
    expect(vista.mostrarMontos).toBe(false);
    expect(vista.materiales!.conPrecios).toBe(false);
    expect(vista.desglose.map((x) => x.etiqueta)).toEqual(['Subtotal']);
    expect(vista.total).toBe('₡300,000');
  });

  it('nombre de archivo', () => {
    expect(nombreArchivo('COT-0008', 'Juan/Pérez')).toBe('Cotización COT-0008 - Juan Pérez');
  });
});

describe('datos viejos o incompletos', () => {
  it('normalizarDatos con nada', () => {
    const d = normalizarDatos(undefined);
    expect(d.partes).toEqual([]);
    expect(d.clienteVe.desglose).toBe(true);
  });
});

describe('PDF: reparto en hojas', async () => {
  const { repartirEnHojas } = await import('../src/lib/exportar.svelte.ts');
  const HOJA = (800 * 297) / 210;

  it('una cotización corta cabe en una hoja', () => {
    expect(repartirEnHojas(900, [100, 500, 900])).toEqual([[0, 900]]);
  });

  it('corta solo entre bloques (nunca a la mitad de un renglón)', () => {
    const cortes = [300, 700, 1100, 1150, 1600, 2000];
    const hojas = repartirEnHojas(2000, cortes);
    expect(hojas[0]).toEqual([0, 1100]); // 1150 ya no cabe en la primera hoja (1131)
    for (const [, hasta] of hojas.slice(0, -1)) expect(cortes).toContain(hasta);
    expect(hojas[hojas.length - 1][1]).toBe(2000);
  });

  it('un bloque más alto que una hoja se parte igual (no se pierde nada)', () => {
    const hojas = repartirEnHojas(3000, [3000]);
    expect(hojas[0]).toEqual([0, HOJA]);
    expect(hojas[hojas.length - 1][1]).toBe(3000);
    for (let i = 1; i < hojas.length; i++) expect(hojas[i][0]).toBe(hojas[i - 1][1]);
  });
});

describe('historial', async () => {
  const { filtrarHistorial, indicadores } = await import('../src/lib/cotizacion.ts');
  const todas = normalizarCotizaciones(leer('cotizaciones.json'));
  const sinFiltro = { texto: '', estado: '', desde: '', hasta: '' };

  it('ordena de la más nueva a la más vieja', () => {
    expect(filtrarHistorial(todas, sinFiltro)[0].numero).toBe('COT-0007');
  });
  it('busca por cliente o lugar', () => {
    expect(filtrarHistorial(todas, { ...sinFiltro, texto: 'heredia' }).map((c) => c.numero)).toEqual(['COT-0003']);
  });
  it('filtra por fechas', () => {
    expect(filtrarHistorial(todas, { ...sinFiltro, desde: '2026-10-01', hasta: '2026-10-31' }).map((c) => c.numero)).toEqual(['COT-0006', 'COT-0005', 'COT-0004']);
  });
  it('indicadores', () => {
    const copia = structuredClone(todas);
    copia[0].estado = 'Aceptada';
    copia[1].estado = 'Rechazada';
    const i = indicadores(copia);
    expect(i.cantidad).toBe(7);
    expect(i.cotizado).toBe(190000 + 800000 + 2900000 + 150000 + 150000 + 240000 + 80000);
    expect(i.aceptado).toBe(190000);
    expect(i.pendientes).toBe(5);
  });
  it('conserva notas internas y quién cambió el estado', () => {
    const c = normalizarCotizaciones([{ ...leer('cotizaciones.json')[0], notasInternas: 'Llamar el lunes', estadoPor: 'Lin', estadoFecha: '2026-11-11' }])[0];
    expect(c).toMatchObject({ notasInternas: 'Llamar el lunes', estadoPor: 'Lin' });
  });
});
