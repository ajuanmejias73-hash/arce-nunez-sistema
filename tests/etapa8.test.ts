import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalizarAjustes, normalizarMateriales } from '../src/lib/normalizar.ts';
import { calcular, datosNuevos, normalizarDatos } from '../src/lib/cotizacion.ts';
import { armarVista } from '../src/lib/modelo.ts';
import type { DatosCotizacion } from '../src/lib/tipos.ts';

const leer = (f: string) => JSON.parse(readFileSync('datos_iniciales/' + f, 'utf8'));
const ajustes = normalizarAjustes(leer('ajustes.json'));
const catalogo = normalizarMateriales(leer('catalogo_materiales.json'));

function base(c: Partial<DatosCotizacion> = {}): DatosCotizacion {
  return { ...datosNuevos(ajustes, 'COT-0200'), cliente: 'Prueba', modoPrecio: 'Total a mano', totalAMano: 339350, porcentajeAdelanto: 0.5, ...c };
}

describe('Descuento', () => {
  it('sin descuento todo queda igual', () => {
    const c = calcular(base(), catalogo, 0.13);
    expect(c.descuento).toBe(0);
    expect(c.total).toBe(339350);
    expect(base().descuento).toBeNull();
  });

  it('por monto: rebaja los colones y dice qué porcentaje es', () => {
    const c = calcular(base({ descuento: { tipo: 'Monto', valor: 100000 } }), catalogo, 0.13);
    expect(c.descuento).toBe(100000);
    expect(c.descuentoPct).toBeCloseTo(0.2947, 4);
    expect(c.total).toBe(239350);
    expect(c.adelanto).toBe(119675);
  });

  it('por porcentaje: calcula el monto', () => {
    const c = calcular(base({ descuento: { tipo: 'Porcentaje', valor: 0.1 } }), catalogo, 0.13);
    expect(c.descuento).toBe(33935);
    expect(c.total).toBe(305415);
  });

  it('se rebaja antes del IVA', () => {
    const c = calcular(base({ cobrarIVA: true, descuento: { tipo: 'Monto', valor: 100000 } }), catalogo, 0.13);
    expect(c.iva).toBe(Math.round(239350 * 0.13));
    expect(c.total).toBe(239350 + Math.round(239350 * 0.13));
  });

  it('nunca rebaja más que el subtotal', () => {
    const c = calcular(base({ descuento: { tipo: 'Monto', valor: 999999 } }), catalogo, 0.13);
    expect(c.descuento).toBe(339350);
    expect(c.total).toBe(0);
  });

  it('el cliente ve la línea del descuento con monto y porcentaje (aunque el desglose esté escondido)', () => {
    for (const desglose of [true, false]) {
      const d = base({ descuento: { tipo: 'Monto', valor: 100000 } });
      d.clienteVe.desglose = desglose;
      const { vista } = armarVista(d, ajustes, catalogo);
      const texto = JSON.stringify(vista);
      expect(texto).toContain('Descuento (29.5%)');
      expect(texto).toContain('−₡100,000');
    }
    const sin = JSON.stringify(armarVista(base(), ajustes, catalogo).vista);
    expect(sin).not.toContain('Descuento');
  });

  it('se guarda y se vuelve a leer igual', () => {
    expect(normalizarDatos({ ...base(), descuento: { tipo: 'Porcentaje', valor: 0.15 } }).descuento).toEqual({ tipo: 'Porcentaje', valor: 0.15 });
    expect(normalizarDatos({ ...base(), descuento: undefined }).descuento).toBeNull();
  });
});
