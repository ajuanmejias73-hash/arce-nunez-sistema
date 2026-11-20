/** Clientes y proveedores. */
import { describe, expect, it } from 'vitest';
import { listaClientes, numeroWhatsApp, proveedorEnUso, resumenProveedor, telefonos } from '../src/lib/contactos.ts';
import { gastosEstimados, presupuesto } from '../src/lib/contabilidad.ts';
import { calcular, datosNuevos, normalizarDatos } from '../src/lib/cotizacion.ts';
import { armarVista } from '../src/lib/modelo.ts';
import { normalizarAjustes, normalizarClientes, normalizarProveedores } from '../src/lib/normalizar.ts';
import type { Cotizacion, DatosCotizacion, FilaMaterial, Movimiento } from '../src/lib/tipos.ts';

const ajustes = normalizarAjustes({ listas: { categoriasGasto: ['Materiales', 'Otros gastos'] } });

function cot(numero: string, cliente: string, estado: string, total: number, fecha: string, d: Partial<DatosCotizacion> = {}): Cotizacion {
  const datos = { ...datosNuevos(ajustes, numero), cliente, fecha, telefono: '8888-1111', ...d };
  return { numero, cliente, estado, versionActual: 1, versiones: [{ version: 1, guardado: fecha, guardadoPor: 'Pablo', queCambio: 'Original', total, adelanto: 0, datos }] };
}

const mov = (m: Partial<Movimiento>): Movimiento => ({
  id: String(Math.random()),
  fecha: '2026-11-10',
  tipo: 'Ingreso',
  categoria: '',
  descripcion: '',
  cotizacion: '',
  persona: '',
  metodo: '',
  monto: 0,
  comprobante: '',
  notas: '',
  registradoPor: 'Pablo',
  registrado: '',
  ...m,
});

describe('clientes', () => {
  const cotizaciones = [
    cot('COT-0001', 'Ana Mora', 'Aceptada', 500000, '2026-10-01'),
    cot('COT-0002', 'ana mora ', 'Pendiente', 300000, '2026-11-01', { telefono: '7777-2222' }),
    cot('COT-0003', 'Luis', 'Rechazada', 100000, '2026-11-02'),
  ];
  const movimientos = [mov({ cotizacion: 'COT-0001', monto: 200000 }), mov({ persona: 'Ana Mora', monto: 5000 })];
  const fichas = normalizarClientes([{ nombre: 'Ana Mora', correo: 'ana@correo.com', cedula: '1-1111-1111' }, { nombre: 'Nuevo Cliente', telefono: '6000-0000' }]);

  it('junta fichas y clientes de las cotizaciones, sin repetir', () => {
    const l = listaClientes(fichas, cotizaciones, movimientos);
    expect(l.map((x) => x.nombre)).toEqual(['Ana Mora', 'Luis', 'Nuevo Cliente']);
    const ana = l[0];
    expect(ana.cotizaciones.map((c) => c.numero)).toEqual(['COT-0002', 'COT-0001']); // la más nueva primero
    expect(ana).toMatchObject({ telefono: '7777-2222', correo: 'ana@correo.com', cedula: '1-1111-1111', aceptado: 500000, pagado: 205000, debe: 300000 });
    expect(l[2]).toMatchObject({ ficha: { nombre: 'Nuevo Cliente' }, cotizaciones: [], debe: 0 });
    // Rechazada: no debe nada.
    expect(l[1]).toMatchObject({ aceptado: 0, debe: 0 });
  });

  it('teléfonos para llamar y WhatsApp', () => {
    expect(telefonos('8888-8888 / 2222 3333')).toEqual(['8888-8888', '2222 3333']);
    expect(numeroWhatsApp('8888-8888')).toBe('50688888888');
    expect(numeroWhatsApp('+1 305 555 1234')).toBe('13055551234');
  });
});

describe('proveedores', () => {
  const [arias] = normalizarProveedores([
    { nombre: 'Vidrios Arias', queVende: 'Vidrios', productos: [{ producto: 'Ventana 2 m', unidad: 'unid', precio: 85000 }, { producto: '' }] },
  ]);
  const filaVentana: FilaMaterial = {
    material: 'Ventana 2 m',
    cantidad: 2,
    unidad: 'unid',
    precioEspecial: null,
    clienteVe: true,
    proveedor: 'Vidrios Arias',
    costoProveedor: 85000,
    ganancia: 0.1,
    mencionarProveedor: false,
  };
  const d = (f: Partial<FilaMaterial> = {}) =>
    normalizarDatos({ ...datosNuevos(ajustes, 'COT-0009'), cliente: 'Ana', quienCompraMateriales: 'Arce Nuñez', materiales: [{ ...filaVentana, ...f }] });

  it('lee el proveedor con sus productos (sin los vacíos)', () => {
    expect(arias.productos).toEqual([{ producto: 'Ventana 2 m', unidad: 'unid', precio: 85000, notas: '' }]);
  });

  it('el precio al cliente es el costo más la ganancia', () => {
    const c = calcular(d(), [], 0.13);
    expect(c.filas[0]).toMatchObject({ precioCatalogo: 93500, precioUsado: 93500, total: 187000 });
    expect(calcular(d({ ganancia: null }), [], 0.13).filas[0].total).toBe(170000);
  });

  it('el cliente ve el proveedor solo si se marcó', () => {
    expect(armarVista(d(), ajustes, []).vista.materiales?.filas[0].material).toBe('Ventana 2 m');
    expect(armarVista(d({ mencionarProveedor: true }), ajustes, []).vista.materiales?.filas[0].material).toBe('Ventana 2 m (Vidrios Arias)');
  });

  it('al aceptarse queda un gasto estimado a nombre del proveedor, por su costo', () => {
    const c = cot('COT-0009', 'Ana', 'Aceptada', 0, '2026-11-19', d());
    const g = gastosEstimados(c, [], 0.13, ajustes.listas.categoriasGasto, '2026-11-19');
    expect(g.map((x) => [x.persona, x.monto])).toEqual([['Vidrios Arias', 170000]]);
    expect(presupuesto(c, [], 0.13)).toMatchObject({ materiales: 187000, costoMateriales: 170000 });
  });

  it('resumen: lo pagado y dónde se usó', () => {
    const c = cot('COT-0009', 'Ana', 'Aceptada', 0, '2026-11-19', d());
    const movs = [mov({ tipo: 'Gasto', persona: 'vidrios arias', monto: 170000 }), mov({ tipo: 'Gasto', persona: 'Otro', monto: 5 })];
    const r = resumenProveedor(arias, [c], movs);
    expect(r.pagado).toBe(170000);
    expect(r.cotizaciones.map((x) => x.numero)).toEqual(['COT-0009']);
    expect(proveedorEnUso('Vidrios Arias', [c], [])).toBe(true);
    expect(proveedorEnUso('Otro proveedor', [c], movs)).toBe(false);
  });
});
