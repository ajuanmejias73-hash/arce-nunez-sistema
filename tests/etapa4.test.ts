import { describe, expect, it } from 'vitest';
import { RENDIMIENTOS_POR_DEFECTO as R } from '../src/lib/normalizar.ts';
import { areas, ceramica, concreto, conversiones, durock, estructura, manoDeObra, pintura, techo, arriba } from '../src/lib/calculadoras.ts';

const cant = (r: { materiales: { material: string; cantidad: number }[] }, nombre: string) => r.materiales.find((m) => m.material === nombre)?.cantidad;

describe('redondeo hacia arriba', () => {
  it('no sube por errores de decimales', () => {
    expect(arriba(10.000000001)).toBe(10);
    expect(arriba(10.01)).toBe(11);
  });
});

describe('1. Áreas', () => {
  it('bruta menos aberturas, nunca negativa', () => {
    const r = areas(
      [{ descripcion: 'Pared', largo: 4, alto: 2.5, cantidad: 2 }, { descripcion: 'Otra', largo: 3, alto: 2.5, cantidad: 1 }],
      [{ descripcion: 'Puerta', largo: 0.9, alto: 2.1, cantidad: 1 }],
    );
    expect(r.bruta).toBe(27.5);
    expect(r.aberturas).toBe(1.89);
    expect(r.neta).toBe(25.61);
    expect(r.resultado.renglon).toBe('Área total: 25.61 m².');
    expect(areas([{ descripcion: '', largo: 1, alto: 1, cantidad: 1 }], [{ descripcion: '', largo: 2, alto: 2, cantidad: 1 }]).neta).toBe(0);
  });
});

describe('2. Pintura', () => {
  it('100 m² a 2 manos con 10%: 6.29 gal → 1 cubeta + 2 galones', () => {
    const r = pintura({ m2: 100, manos: 2, sellador: false, desperdicio: 0.1 }, R);
    // 100 × 2 ÷ 35 × 1.1 = 6.2857 galones
    expect(cant(r, 'Pintura (cubeta)')).toBe(1);
    expect(cant(r, 'Pintura (galón)')).toBe(2);
    expect(cant(r, 'Sellador (galón)')).toBe(0);
    expect(r.materiales.find((m) => m.material.startsWith('Rodillo'))!.agregar).toBe(false);
    expect(r.renglon).toBe('Pintura de 100 m² a 2 manos.');
  });
  it('con sellador', () => {
    expect(cant(pintura({ m2: 100, manos: 2, sellador: true, desperdicio: 0.1 }, R), 'Sellador (galón)')).toBe(3); // 100÷40×1.1 = 2.75
  });
  it('cubetas exactas: no pide un galón de más', () => {
    // 175 m² × 1 mano ÷ 35 = 5 galones exactos = 1 cubeta, 0 galones
    const r = pintura({ m2: 175, manos: 1, sellador: false, desperdicio: 0 }, R);
    expect(cant(r, 'Pintura (cubeta)')).toBe(1);
    expect(cant(r, 'Pintura (galón)')).toBe(0);
  });
});

describe('3. Durock', () => {
  it('pared de 6 × 3 a 2 caras', () => {
    const r = durock({ largo: 6, alto: 3, caras: 2, aberturas: 0, separacion: 0.41, esquineros: 4, repello: true, desperdicio: 0.1 }, R);
    // 36 m²; láminas ↑(36 ÷ 2.9768 × 1.1) = ↑13.30 = 14
    expect(cant(r, 'Lámina Durock 1,22 x 2,44 m de 1/2"')).toBe(14);
    // studs (↑(6 ÷ 0.41) + 1) × ↑(3 ÷ 3.05) = (15 + 1) × 1 = 16
    expect(cant(r, 'Stud calibre 22')).toBe(16);
    expect(cant(r, 'Track calibre 22')).toBe(4); // ↑(12 ÷ 3.05) = ↑3.93
    expect(cant(r, 'Tornillo punta broca 1 1/4"')).toBe(14 * 30);
    expect(cant(r, 'Malla de fibra de vidrio 2"')).toBe(1); // ↑(36 × 1.4 ÷ 90)
    expect(cant(r, 'Repello SUR fino blanco')).toBe(9); // 36 ÷ 4
    expect(cant(r, 'Esquinero plástico para gypsum')).toBe(4);
    expect(r.renglon).toBe('Pared en Durock de 6 m x 3 m (2 caras): 36 m².');
  });
});

describe('4. Cerámica', () => {
  it('20 m² con 10% y cajas de 1.5 m²', () => {
    const r = ceramica({ m2: 20, desperdicio: 0.1, m2PorCaja: 1.5, nombre: 'Porcelanato gris' }, R);
    expect(r.materiales[0]).toMatchObject({ material: 'Porcelanato gris', cantidad: 15, agregar: false }); // ↑(22 ÷ 1.5) = ↑14.67
    expect(cant(r, 'Pegamento para cerámica')).toBe(5);
    expect(cant(r, 'Fragua')).toBe(4);
  });
});

describe('5. Concreto', () => {
  it('losa de 3 × 3 × 10 cm de 210 con 5%', () => {
    const r = concreto({ mezcla: { tipo: 'Concreto 210 kg/cm²', cemento: 7.2, arena: 0.5, piedra: 0.7, agua: 190 }, largo: 3, ancho: 3, espesorCm: 10, cantidad: 1, desperdicio: 0.05 });
    // 0.945 m³
    expect(cant(r, 'Cemento')).toBe(7); // ↑6.804
    expect(cant(r, 'Arena')).toBe(0.47);
    expect(cant(r, 'Piedra quintilla')).toBe(0.66);
    expect(r.renglon).toBe('Concreto 210 kg/cm² de 3 m x 3 m x 10 cm: 0.95 m³.');
  });
});

describe('6. Techos', () => {
  it('4 m de caída, 6 m de frente, 15%', () => {
    const r = techo({ largo: 4, ancho: 6, pendiente: 0.15, largoLamina: 3.66, anchoUtil: 0.8, lamina: 'Lámina de policarbonato', canoa: true }, R);
    // inclinado = 4 × √1.0225 = 4.0447; filas = ↑((4.0447 − 0.15) ÷ 3.51) = 2; por fila ↑(6 ÷ 0.8) = 8
    expect(cant(r, 'Lámina de policarbonato')).toBe(16);
    expect(cant(r, 'Tornillo de techo')).toBe(128);
    expect(cant(r, 'Canoa')).toBe(6);
    expect(r.renglon).toBe('Techo de 24.27 m² (16 láminas).');
  });
});

describe('7. Estructura metálica', () => {
  it('suma piezas por material', () => {
    const r = estructura(
      [
        { material: 'Tubo 2x4"', medida: 2.5, cortes: 4, largoPieza: 6 },
        { material: 'Tubo 2x4"', medida: 1, cortes: 3, largoPieza: 6 },
        { material: 'Platina 1" x 3/16"', medida: 0.3, cortes: 10, largoPieza: 6 },
      ],
      0.05,
    );
    // 10 m × 1.05 ÷ 6 = ↑1.75 = 2; 3 × 1.05 ÷ 6 = ↑0.525 = 1 → 3 tubos; platina 3 × 1.05 ÷ 6 = 1
    expect(cant(r, 'Tubo 2x4"')).toBe(3);
    expect(cant(r, 'Platina 1" x 3/16"')).toBe(1);
    expect(r.renglon).toBe('Estructura metálica: 16 m lineales de tubo.');
  });
});

describe('8. Mano de obra', () => {
  it('por hora con personas', () => {
    const r = manoDeObra({ forma: 'Por hora', cantidad: 40, precio: 3500, personas: 2, imprevistos: 0 });
    expect(r.monto).toBe(280000);
    expect(r.renglon).toBe('Se trabajan 40 horas a ₡3,500 por hora (2 personas).');
  });
  it('por m² no multiplica personas; imprevistos suben el monto', () => {
    expect(manoDeObra({ forma: 'Por m²', cantidad: 20, precio: 5000, personas: 3, imprevistos: 0.1 }).monto).toBe(110000);
  });
  it('precio fijo y por día', () => {
    expect(manoDeObra({ forma: 'Precio fijo', cantidad: 99, precio: 150000, personas: 2, imprevistos: 0 })).toMatchObject({ monto: 150000, renglon: 'Trabajo a precio fijo.' });
    expect(manoDeObra({ forma: 'Por día', cantidad: 5, precio: 20000, personas: 2, imprevistos: 0 })).toMatchObject({ monto: 200000, renglon: '5 días de trabajo con 2 personas.' });
  });
});

describe('9. Conversiones', () => {
  it('varas y pulgadas', () => {
    const c = conversiones(1, 0.8359);
    expect(c.find((x) => x.de === 'pulgadas')!.valor).toBeCloseTo(2.54);
    expect(c.find((x) => x.de === 'varas²')!.valor).toBeCloseTo(0.6987, 3);
    expect(c.find((x) => x.de === 'galones')!.valor).toBeCloseTo(3.785);
  });
});

describe('Agregar a la cotización', async () => {
  const { agregarACotizacion } = await import('../src/lib/agregar.ts');
  const { normalizarDatos } = await import('../src/lib/cotizacion.ts');
  const catalogo = [{ material: 'Cemento', unidad: 'saco', precio: 7000, categoria: '', notas: '' }];
  const base = () =>
    normalizarDatos({
      numero: 'COT-0100',
      partes: [{ nombre: 'Piso', monto: 50000, renglones: [{ texto: 'Ya escrito', clienteVe: true }] }],
      materiales: [{ material: 'Cemento', cantidad: 3, unidad: '', clienteVe: true }],
    });

  it('renglón en la Parte, suma materiales repetidos y agrega los nuevos', () => {
    const d = base();
    const r = concreto({ mezcla: { tipo: 'Concreto 210 kg/cm²', cemento: 7.2, arena: 0.5, piedra: 0.7, agua: 190 }, largo: 3, ancho: 3, espesorCm: 10, cantidad: 1, desperdicio: 0.05 });
    const res = agregarACotizacion(d, r, { parte: 0, clienteVe: true, monto: 'sumar' }, catalogo);
    expect(d.partes[0].renglones.map((x) => x.texto)).toEqual(['Ya escrito', r.renglon]);
    expect(d.materiales.find((m) => m.material === 'Cemento')!.cantidad).toBe(10); // 3 + 7
    expect(d.materiales.find((m) => m.material === 'Arena')).toMatchObject({ cantidad: 0.47, unidad: 'm³' }); // no está en el catálogo: lleva su unidad
    expect(res.sumados).toEqual(['Cemento']);
    expect(res.nuevos).toEqual(['Arena', 'Piedra quintilla']);
    expect(d.modoPrecio).toBe('Total a mano'); // sin mano de obra no cambia el modo
  });

  it('lo que no se marca para agregar o queda en 0 no se agrega', () => {
    const d = base();
    agregarACotizacion(d, pintura({ m2: 100, manos: 2, sellador: false, desperdicio: 0.1 }, R), { parte: 0, clienteVe: true, monto: 'sumar' }, catalogo);
    const nombres = d.materiales.map((m) => m.material);
    expect(nombres).not.toContain('Sellador (galón)'); // cantidad 0
    expect(nombres).not.toContain('Rodillo 9" antigoteo'); // agregar = No
  });

  it('mano de obra en Parte nueva y oculta: pone el monto, cambia el modo y apaga "Monto de cada Parte"', () => {
    const d = base();
    const res = agregarACotizacion(d, manoDeObra({ forma: 'Por hora', cantidad: 10, precio: 3000, personas: 1, imprevistos: 0 }), { parte: { nueva: 'Instalación' }, clienteVe: false, monto: 'sumar' }, catalogo);
    expect(d.partes[1]).toMatchObject({ nombre: 'Instalación', monto: 30000 });
    expect(d.partes[1].renglones[0].clienteVe).toBe(false);
    expect(d.modoPrecio).toBe('Partes + materiales');
    expect(d.clienteVe.montoPartes).toBe(false);
    expect(res.parte).toBe('PARTE II · Instalación');
  });

  it('monto: sumar o reemplazar lo que ya tenía la Parte', () => {
    const r = manoDeObra({ forma: 'Precio fijo', cantidad: 0, precio: 20000, personas: 1, imprevistos: 0 });
    const a = base();
    agregarACotizacion(a, r, { parte: 0, clienteVe: true, monto: 'sumar' }, catalogo);
    expect(a.partes[0].monto).toBe(70000);
    const b = base();
    agregarACotizacion(b, r, { parte: 0, clienteVe: true, monto: 'reemplazar' }, catalogo);
    expect(b.partes[0].monto).toBe(20000);
  });

  it('usa el primer renglón vacío', () => {
    const d = normalizarDatos({ partes: [{ nombre: 'A', renglones: [] }] });
    d.partes[0].renglones.push({ texto: '', clienteVe: true }, { texto: '', clienteVe: true });
    agregarACotizacion(d, areas([{ descripcion: '', largo: 2, alto: 2, cantidad: 1 }], []).resultado, { parte: 0, clienteVe: true, monto: 'sumar' }, []);
    expect(d.partes[0].renglones[0].texto).toBe('Área total: 4 m².');
  });
});
