import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalizarAjustes, normalizarMateriales } from '../src/lib/normalizar.ts';
import { calcular, datosNuevos, normalizarCotizaciones, ultimaVersion } from '../src/lib/cotizacion.ts';
import { armarVista } from '../src/lib/modelo.ts';
import { categoriaSugerida, gastosEstimados, porObra, presupuesto } from '../src/lib/contabilidad.ts';
import { MARCA_CODIGO, instruccionCotizacion, leerCodigo } from '../src/lib/autocotizar.ts';
import type { Cotizacion, DatosCotizacion, Material } from '../src/lib/tipos.ts';

const leer = (f: string) => JSON.parse(readFileSync('datos_iniciales/' + f, 'utf8'));
const ajustes = normalizarAjustes(leer('ajustes.json'));
const catalogo = normalizarMateriales(leer('catalogo_materiales.json'));
const cotizaciones = normalizarCotizaciones(leer('cotizaciones.json'));
const cat: Material[] = [{ material: 'Cemento', unidad: 'saco', precio: 7000, categoria: '', notas: '' }];

function base(c: Partial<DatosCotizacion> = {}): DatosCotizacion {
  return {
    ...datosNuevos(ajustes, 'COT-0100'),
    cliente: 'Prueba',
    fecha: '2026-11-13',
    modoPrecio: 'Partes + materiales',
    quienCompraMateriales: 'Arce Nuñez',
    partes: [{ nombre: 'Piso', monto: 100000, renglones: [{ texto: 'Chorrea', clienteVe: true }] }],
    materiales: [{ material: 'Cemento', cantidad: 10, unidad: '', precioEspecial: null, clienteVe: true }],
    extras: [
      { concepto: 'Transporte de material', monto: 25000, categoria: 'Transporte / acarreo', clienteVe: false },
      { concepto: 'Póliza INS', monto: 15000, categoria: 'CCSS / impuestos', clienteVe: true },
    ],
    ...c,
  };
}

describe('costos extras', () => {
  it('se suman al total', () => {
    const r = calcular(base(), cat, 0.13);
    expect(r).toMatchObject({ manoDeObra: 100000, materiales: 70000, extras: 40000, extrasOcultos: 25000, subtotal: 210000, total: 210000 });
  });

  it('el cliente no ve los escondidos, pero el desglose cuadra', () => {
    const { vista } = armarVista(base(), ajustes, cat);
    const lineas = Object.fromEntries(vista.desglose.map((x) => [x.etiqueta, x.valor]));
    expect(lineas['Mano de obra']).toBe('₡125,000'); // 100,000 + 25,000 de transporte escondido
    expect(lineas['Materiales']).toBe('₡70,000');
    expect(lineas['Póliza INS']).toBe('₡15,000'); // este sí lo ve
    expect(lineas['Transporte de material']).toBeUndefined();
    expect(lineas['Subtotal']).toBe('₡210,000');
  });

  it('en "Total a mano" también se suman', () => {
    const d = base({ modoPrecio: 'Total a mano', totalAMano: 300000 });
    expect(calcular(d, cat, 0.13).total).toBe(340000);
    const { vista } = armarVista(d, ajustes, cat);
    expect(vista.desglose.map((x) => x.etiqueta)).toEqual(['Trabajo', 'Póliza INS', 'Subtotal']);
  });

  it('las cotizaciones viejas (sin extras) no cambian', () => {
    for (const c of cotizaciones) expect(calcular(ultimaVersion(c).datos, catalogo, 0.13).total, c.numero).toBe(ultimaVersion(c).total);
  });
});

describe('gastos estimados al aceptarse y presupuesto', () => {
  const cot = (d: DatosCotizacion): Cotizacion => ({
    numero: 'COT-0100',
    cliente: 'Prueba',
    estado: 'Aceptada',
    versionActual: 1,
    versiones: [{ version: 1, guardado: '', guardadoPor: 'Pablo', queCambio: 'Original', total: 0, adelanto: 0, datos: d }],
  });

  it('materiales (si los compra Arce Nuñez) y cada extra, marcados como estimados', () => {
    const g = gastosEstimados(cot(base()), cat, 0.13, ajustes.listas.categoriasGasto, '2026-11-13');
    expect(g.map((x) => [x.categoria, x.monto, x.estimado])).toEqual([
      ['Materiales', 70000, true],
      ['Transporte / acarreo', 25000, true],
      ['CCSS / impuestos', 15000, true],
    ]);
    expect(g[0]).toMatchObject({ tipo: 'Gasto', cotizacion: 'COT-0100', fecha: '2026-11-13' });
  });

  it('si los materiales los compra el cliente, solo los extras', () => {
    const g = gastosEstimados(cot(base({ quienCompraMateriales: 'El cliente' })), cat, 0.13, ajustes.listas.categoriasGasto);
    expect(g.map((x) => x.categoria)).toEqual(['Transporte / acarreo', 'CCSS / impuestos']);
  });

  it('presupuesto y comparación por obra', () => {
    const c = cot(base());
    expect(presupuesto(c, cat, 0.13)).toEqual({ materiales: 70000, extras: 40000, manoDeObra: 100000 });
    const o = porObra([c], [], [], cat, 0.13)[0];
    expect(o).toMatchObject({ presupuestoGastos: 110000, manoDeObraCotizada: 100000, planillaTotal: 0 });
  });

  it('categoría sugerida por el nombre del extra', () => {
    const cats = ajustes.listas.categoriasGasto;
    expect(categoriaSugerida('Transporte de material', cats)).toBe('Transporte / acarreo');
    expect(categoriaSugerida('Póliza de riesgos INS', cats)).toBe('CCSS / impuestos');
    expect(categoriaSugerida('Alquiler de andamios', cats)).toBe('Alquiler de equipo');
    expect(categoriaSugerida('Algo raro', cats)).toBe('Otros gastos');
  });
});

describe('cotización automática con Claude', () => {
  const contexto = { ajustes, materiales: [...catalogo, { material: 'Cemento gris', unidad: 'saco', precio: 7200, categoria: '', notas: '' }], servicios: [], cotizaciones };

  it('la instrucción trae precios, catálogo, ejemplos, preguntas con opciones y el formato del código', () => {
    const t = instruccionCotizacion(contexto);
    expect(t).toContain('Cemento gris | saco | ₡7,200');
    expect(t).toContain('Lámina Durock 1,22 x 2,44 m de 1/2" (lámina)'); // sin precio
    expect(t).toContain('SELECCIÓN MÚLTIPLE');
    expect(t).toContain('"Otro (escribí tu respuesta)"');
    expect(t).toContain(MARCA_CODIGO);
    expect(t).toContain('NUNCA inventes un precio');
    expect(t).toMatch(/Parte «.+»:/); // ejemplos de sus cotizaciones
  });

  it('el ejemplo de código de la misma instrucción se puede leer', () => {
    const t = instruccionCotizacion(contexto);
    const { datos } = leerCodigo(t.split('EL CÓDIGO FINAL')[1], datosNuevos(ajustes, 'COT-0008'), catalogo, ajustes.listas.categoriasGasto);
    expect(datos.numero).toBe('COT-0008');
    expect(datos.partes[0]).toMatchObject({ nombre: 'Estructura', monto: 150000 });
  });

  it('llena la cotización con lo que respondió Claude', () => {
    const respuesta = `¡Listo! Aquí está el código:
\`\`\`json
{
  "${MARCA_CODIGO}": 1,
  "cliente": "Doña Marta",
  "telefono": "8888-1234",
  "ubicacion": "Grecia",
  "tipoTrabajo": "Techos",
  "trabajoSolicitado": "Techo de cochera",
  "modoPrecio": "Partes + materiales",
  "quienCompraMateriales": "Arce Nuñez",
  "porcentajeAdelanto": 40,
  "partes": [
    { "nombre": "Estructura", "monto": 180000, "renglones": ["A. Corte de tubos.", "B. Soldadura."], "renglonesOcultos": ["Revisar nivel"] },
    { "nombre": "Cubierta", "monto": null, "renglones": ["A. Láminas."] },
  ],
  "materiales": [
    { "material": "cemento", "cantidad": 4, "unidad": "saco", "precio": 7000 },
    { "material": "Lámina de zinc #26", "cantidad": "pendiente", "unidad": "lámina", "precio": 9500 }
  ],
  "extras": [{ "concepto": "Transporte de material", "monto": "₡30,000" }],
  "notas": ["Incluye limpieza final."]
}
\`\`\`
¿Querés cambiar algo?`;
    const { datos, avisos } = leerCodigo(respuesta, datosNuevos(ajustes, 'COT-0008'), [{ material: 'Cemento', unidad: 'saco', precio: 7000, categoria: '', notas: '' }], ajustes.listas.categoriasGasto);
    expect(datos).toMatchObject({ numero: 'COT-0008', cliente: 'Doña Marta', tipoTrabajo: 'Techos', porcentajeAdelanto: 0.4, quienCompraMateriales: 'Arce Nuñez' });
    expect(datos.partes[0].renglones).toEqual([
      { texto: 'A. Corte de tubos.', clienteVe: true },
      { texto: 'B. Soldadura.', clienteVe: true },
      { texto: 'Revisar nivel', clienteVe: false },
    ]);
    // Nombre igual al catálogo, sin precio especial (es el mismo) y sin unidad (usa la del catálogo)
    expect(datos.materiales[0]).toEqual({ material: 'Cemento', cantidad: 4, unidad: '', precioEspecial: null, clienteVe: true });
    expect(datos.materiales[1]).toEqual({ material: 'Lámina de zinc #26', cantidad: 'pendiente', unidad: 'lámina', precioEspecial: 9500, clienteVe: true });
    expect(datos.extras).toEqual([{ concepto: 'Transporte de material', monto: 30000, categoria: 'Transporte / acarreo', clienteVe: false }]);
    expect(datos.notas).toEqual(['Incluye limpieza final.']);
    expect(avisos).toEqual(['1 Parte no tiene monto.', '1 material no está en el catálogo (se pueden agregar desde la cotización).']);
  });

  it('si no es un código, lo dice claro', () => {
    expect(() => leerCodigo('hola, ¿cómo estás?', datosNuevos(ajustes, 'COT-0008'), [], [])).toThrow(/No encontré el código/);
  });
});
