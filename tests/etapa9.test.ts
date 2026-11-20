/** Catálogo grande (El Lagar): categoría → tipo → medida. */
import { describe, expect, it } from 'vitest';
import { buscar, categorias, deTipo, etiquetaMedida, tipos } from '../src/lib/catalogo.ts';
import { instruccionCotizacion } from '../src/lib/autocotizar.ts';
import { calcular, datosNuevos } from '../src/lib/cotizacion.ts';
import { normalizarAjustes, normalizarMateriales } from '../src/lib/normalizar.ts';
import type { Material } from '../src/lib/tipos.ts';

const m = (material: string, categoria: string, tipo: string, precio: number | null = 1000, unidad = 'unid'): Material => ({
  material,
  unidad,
  precio,
  categoria,
  notas: '',
  tipo,
  medida: material.slice(tipo.length).trim(),
});

const lista: Material[] = [
  m('Tornillo Gypsum Punta Broca 6 X 1 1/4" 100 Unidades', 'Tornillería y anclajes', 'Tornillo Gypsum Punta Broca', 1580, 'paquete'),
  m('Tornillo Gypsum Punta Broca 6 X 1/2" 100 Unidades', 'Tornillería y anclajes', 'Tornillo Gypsum Punta Broca', 1150, 'paquete'),
  m('Tornillo Gypsum Punta Fina 6 X 1" 100 Unidades', 'Tornillería y anclajes', 'Tornillo Gypsum Punta Fina', 990, 'paquete'),
  m('Lámina Gypsum Regular 1/2"', 'Gypsum, Durock y cielos', 'Lámina Gypsum Regular', 7900, 'lámina'),
  { material: 'Flete', unidad: 'viaje', precio: 15000, categoria: 'Servicios', notas: '' },
  { material: 'Algo suelto', unidad: 'unid', precio: null, categoria: '', notas: '' },
];

describe('catálogo por categoría, tipo y medida', () => {
  it('cuenta las categorías y pone las que no tienen en "Sin categoría"', () => {
    expect(categorias(lista)).toEqual([
      { nombre: 'Gypsum, Durock y cielos', cantidad: 1 },
      { nombre: 'Servicios', cantidad: 1 },
      { nombre: 'Sin categoría', cantidad: 1 },
      { nombre: 'Tornillería y anclajes', cantidad: 3 },
    ]);
  });

  it('separa los tipos de una categoría (punta broca y punta fina)', () => {
    expect(tipos(lista, 'Tornillería y anclajes')).toEqual([
      { nombre: 'Tornillo Gypsum Punta Broca', cantidad: 2 },
      { nombre: 'Tornillo Gypsum Punta Fina', cantidad: 1 },
    ]);
    // Sin tipo, el material es su propio tipo.
    expect(tipos(lista, 'Servicios')).toEqual([{ nombre: 'Flete', cantidad: 1 }]);
  });

  it('ordena las medidas de un tipo y muestra solo lo que cambia', () => {
    const ms = deTipo(lista, 'Tornillería y anclajes', 'Tornillo Gypsum Punta Broca');
    expect(ms.map(etiquetaMedida)).toEqual(['6 X 1 1/4" 100 Unidades', '6 X 1/2" 100 Unidades']);
    expect(etiquetaMedida(lista[4])).toBe('Flete');
  });

  it('busca por palabras sueltas, sin importar tildes ni orden', () => {
    expect(buscar(lista, 'broca gypsum').length).toBe(2);
    expect(buscar(lista, 'lamina').map((x) => x.material)).toEqual(['Lámina Gypsum Regular 1/2"']);
    expect(buscar(lista, '').length).toBe(lista.length);
  });

  it('el tipo, la medida y el código no se pierden al leer los datos', () => {
    const [x] = normalizarMateriales([{ ...lista[0], codigo: 'lagar:7084675' }]);
    expect(x).toMatchObject({ tipo: 'Tornillo Gypsum Punta Broca', medida: '6 X 1 1/4" 100 Unidades', codigo: 'lagar:7084675' });
    const [y] = normalizarMateriales([{ material: 'Viejo', unidad: 'unid', precio: 5, categoria: '', notas: '' }]);
    expect('tipo' in y || 'codigo' in y).toBe(false);
  });

  it('una cotización vieja encuentra el precio por el nombre de antes', () => {
    const cat: Material[] = [{ ...lista[0], antes: ['Tornillos Gypsum 1 1/4" PB'] }];
    const d = datosNuevos(normalizarAjustes({}), 'COT-0001');
    d.materiales = [{ material: 'Tornillos Gypsum 1 1/4" PB', cantidad: 2, unidad: '', precioEspecial: null, clienteVe: true }];
    const c = calcular(d, cat, 0.13);
    expect(c.filas[0]).toMatchObject({ precioCatalogo: 1580, total: 3160, unidadFinal: 'paquete' });
    expect(buscar(cat, 'PB').length).toBe(1);
  });

  it('la cotización automática lleva solo las categorías escogidas, agrupadas', () => {
    const contexto = { ajustes: normalizarAjustes({}), materiales: lista, servicios: [], cotizaciones: [] };
    const todas = instruccionCotizacion(contexto);
    expect(todas).toContain('▸ Tornillería y anclajes:');
    expect(todas).toContain('Lámina Gypsum Regular');

    const solo = instruccionCotizacion({ ...contexto, categorias: ['Tornillería y anclajes'] });
    expect(solo).toContain('Tornillo Gypsum Punta Fina 6 X 1" 100 Unidades | paquete | ₡990');
    expect(solo).not.toContain('Lámina Gypsum Regular');
    expect(solo).not.toContain('Flete');
    expect(solo).toContain('solo van los materiales de las categorías que escogí');
  });
});
