import { describe, expect, it } from 'vitest';
import { RENDIMIENTOS_POR_DEFECTO as R } from '../src/lib/normalizar.ts';
import { pisos, type OpcionesPiso } from '../src/lib/calculadoras.ts';
import { calcularPlano, leerRespuesta, INSTRUCCION_CHAT } from '../src/lib/plano.ts';

// El plano que mandó el usuario: cuarto principal, baño y walk-in closet, 3 puertas de 1.05 m.
const espacios = [
  { nombre: 'Cuarto principal', largo: 3.5, ancho: 4 },
  { nombre: 'Baño', largo: 2.25, ancho: 2.2 },
  { nombre: 'Walk-in closet', largo: 1.25, ancho: 2.2 },
];
const mezcla = { tipo: 'Concreto 175 kg/cm²', cemento: 6.2, arena: 0.52, piedra: 0.75, agua: 190 };
const base: OpcionesPiso = {
  ceramica: true,
  desperdicio: 0.1,
  m2PorCaja: 1.5,
  nombreCeramica: 'Porcelanato',
  rodapie: true,
  anchoPuertas: 3 * 1.05,
  contrapiso: false,
  mezcla,
  espesorCm: 8,
  desperdicioConcreto: 0.05,
};
const cant = (r: { materiales: { material: string; cantidad: number }[] }, n: string) => r.materiales.find((m) => m.material === n)?.cantidad;

describe('10. Pisos', () => {
  it('área total y cerámica del plano de ejemplo', () => {
    const r = pisos(espacios, base, R);
    // 14 + 4.95 + 2.75 = 21.70 m²
    expect(r.extras![0].valor).toBe('21.7 m²');
    expect(cant(r, 'Porcelanato')).toBe(16); // ↑(21.7 × 1.1 ÷ 1.5) = ↑15.91
    expect(cant(r, 'Pegamento para cerámica')).toBe(6); // ↑(21.7 ÷ 4)
    expect(cant(r, 'Fragua')).toBe(5); // ↑(21.7 ÷ 5)
    expect(r.renglon).toBe('Piso (cerámica): 21.7 m² en 3 espacios.');
  });

  it('rodapié: perímetro menos puertas, con desperdicio', () => {
    // perímetros 15 + 8.9 + 6.9 = 30.8; menos 3.15 de puertas = 27.65; × 1.1 = 30.42 → 31 m
    expect(cant(pisos(espacios, base, R), 'Rodapié')).toBe(31);
  });

  it('contrapiso de 8 cm', () => {
    const r = pisos(espacios, { ...base, ceramica: false, rodapie: false, contrapiso: true }, R);
    // 21.7 × 0.08 × 1.05 = 1.8228 m³ → cemento ↑(1.8228 × 6.2) = 12 sacos
    expect(cant(r, 'Cemento')).toBe(12);
    expect(cant(r, 'Arena')).toBe(0.95);
    expect(cant(r, 'Piedra quintilla')).toBe(1.37);
    expect(r.renglon).toBe('Piso (contrapiso de 8 cm): 21.7 m² en 3 espacios.');
  });

  it('espacios vacíos no cuentan', () => {
    const r = pisos([...espacios, { nombre: '', largo: 0, ancho: 3 }], { ...base, ceramica: false, rodapie: false }, R);
    expect(r.renglon).toBe('Piso: 21.7 m² en 3 espacios.');
  });
});

describe('Paredes: cara interna y externa', async () => {
  const { paredes } = await import('../src/lib/calculadoras.ts');
  const DUROCK = 'Lámina Durock 1,22 x 2,44 m de 1/2"';
  const cara = (m2: number, lamina = DUROCK, repello = true) => ({ lleva: true, m2, lamina, repello });
  const base = { largo: 6, alto: 3, separacion: 0.41, esquineros: 4, desperdicio: 0.1 };

  it('mismo resultado que antes con Durock en las dos caras (6 × 3)', () => {
    const r = paredes({ ...base, interna: cara(18), externa: cara(18) }, R);
    expect(cant(r, DUROCK)).toBe(14); // se junta: ↑(36 ÷ 2.9768 × 1.1)
    expect(cant(r, 'Stud calibre 22')).toBe(16);
    expect(cant(r, 'Track calibre 22')).toBe(4);
    expect(cant(r, 'Tornillo punta broca 1 1/4"')).toBe(420);
    expect(cant(r, 'Malla de fibra de vidrio 2"')).toBe(1);
    expect(cant(r, 'Repello SUR fino blanco')).toBe(9);
  });

  it('gypsum adentro y Durock afuera, con m² distintos', () => {
    const r = paredes({ ...base, interna: cara(15, 'Lámina de gypsum', false), externa: cara(20) }, R);
    expect(cant(r, 'Lámina de gypsum')).toBe(6); // ↑(15 ÷ 2.9768 × 1.1) = ↑5.54
    expect(cant(r, DUROCK)).toBe(8); // ↑(20 ÷ 2.9768 × 1.1) = ↑7.39
    expect(cant(r, 'Tornillo punta broca 1 1/4"')).toBe(14 * 30);
    expect(cant(r, 'Repello SUR fino blanco')).toBe(5); // solo la externa: 20 ÷ 4
    expect(r.renglon).toBe('Pared de 6 m x 3 m: cara interna en gypsum (15 m²) y cara externa en Durock (20 m²).');
  });

  it('solo una cara, por m² y sin largo: no calcula studs', () => {
    const r = paredes({ ...base, largo: 0, alto: 0, interna: { ...cara(10), lleva: false }, externa: cara(10) }, R);
    expect(cant(r, 'Stud calibre 22')).toBe(0);
    expect(r.renglon).toBe('Paredes: cara externa en Durock (10 m²).');
  });
});

describe('Plano: leer la respuesta del chat', () => {
  it('formato pedido', () => {
    const { plano, ignoradas } = leerRespuesta(
      ['ALTO: 2.50', 'CUARTO: Cuarto principal | 3.50 | 4.00', 'CUARTO: Baño | 2.25 | 2.20', 'CUARTO: Walk-in closet | 1.25 | 2.20', 'PUERTA: Puerta | 1.05 | 2.10 | 3', 'VENTANA: Ventana cuarto | 2.00 | 1.00 | 1 (estimado)'].join('\n'),
    );
    expect(ignoradas).toEqual([]);
    expect(plano.altoParedes).toBe(2.5);
    expect(plano.cuartos.map((c) => [c.nombre, c.largo, c.ancho])).toEqual([['Cuarto principal', 3.5, 4], ['Baño', 2.25, 2.2], ['Walk-in closet', 1.25, 2.2]]);
    expect(plano.aberturas[0]).toEqual({ tipo: 'Puerta', nombre: 'Puerta', ancho: 1.05, alto: 2.1, cantidad: 3 });
    expect(plano.aberturas[1]).toMatchObject({ tipo: 'Ventana', ancho: 2, alto: 1, cantidad: 1, estimado: true });
  });

  it('tolera lo que suelen hacer los chats: negritas, viñetas, comas, "x", texto extra', () => {
    const { plano, ignoradas } = leerRespuesta(
      ['Claro, aquí están las medidas:', '- **CUARTO:** Cocina ; 3,10 ; 2,80', '* cuarto: Pasillo 1.20 x 4.50', 'Puertas: Principal | 0.90 | 2.10', 'VENTANA: Baño | 0,60'].join('\n'),
    );
    expect(plano.cuartos.map((c) => [c.nombre, c.largo, c.ancho])).toEqual([['Cocina', 3.1, 2.8], ['Pasillo', 1.2, 4.5]]);
    expect(plano.aberturas).toEqual([{ tipo: 'Puerta', nombre: 'Principal', ancho: 0.9, alto: 2.1, cantidad: 1 }]);
    expect(ignoradas).toEqual(['Claro, aquí están las medidas:', 'VENTANA: Baño | 0,60']); // la ventana no tiene alto
  });

  it('cálculos del plano', () => {
    const { plano } = leerRespuesta(['ALTO: 2.50', 'CUARTO: A | 3.50 | 4.00', 'CUARTO: B | 2.25 | 2.20', 'PUERTA: P | 1.05 | 2.10 | 3', 'VENTANA: V | 2 | 1 | 1'].join('\n'));
    const c = calcularPlano(plano);
    expect(c.area).toBe(18.95);
    expect(c.perimetro).toBe(23.9);
    expect(c.paredesBrutas).toBe(59.75); // 23.9 × 2.5
    expect(c.huecos).toBe(8.62); // 3 × 1.05 × 2.10 + 2
    expect(c.paredesNetas).toBe(51.13);
    expect(c.anchoPuertas).toBe(3.15);
    expect(c.cuartos[0]).toMatchObject({ area: 14, perimetro: 15, paredes: 37.5 });
  });

  it('la instrucción general trae todos los tipos, y su ejemplo se lee completo', () => {
    for (const t of ['ALTO:', 'ESPACIO:', 'PARED:', 'PUERTA:', 'VENTANA:', 'TECHO:', 'LOSA:', 'TUBO:', 'NOTA:']) expect(INSTRUCCION_CHAT).toContain(t);
    const { plano, ignoradas } = leerRespuesta(INSTRUCCION_CHAT.split('Ejemplo:')[1]);
    expect(ignoradas).toEqual([]);
    expect([plano.cuartos, plano.paredes, plano.techos, plano.losas, plano.tubos, plano.notas].map((l) => l.length)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(plano.aberturas).toHaveLength(2);
  });

  it('un plano con de todo: techo, losa, portón con tubos, paredes y notas', () => {
    const { plano, ignoradas } = leerRespuesta(
      [
        '**PAREDES:** Pared lateral | 6.00 | 2.80 | 1',
        'PARED: Divisoria | 3.00 | 2.80',
        'TECHO: Cochera | 4.00 | 6.00 | 15',
        'TECHOS: Corredor | 2,5 | 8 (estimado)',
        'LOSA: Contrapiso cochera | 6 | 4 | 8',
        'LOSA: Acera | 6 | 1',
        'TUBOS: Tubo 2x2 galvanizado | 2.00 | 6',
        'TUBO: Tubo 1x1 | 1.20 | 14',
        'PORTÓN: Portón principal | 3.00 | 2.00 | 1',
        'NOTA: Lleva malla ciclón abajo.',
      ].join('\n'),
    );
    expect(plano.paredes).toEqual([
      { nombre: 'Pared lateral', largo: 6, alto: 2.8, caras: 1 },
      { nombre: 'Divisoria', largo: 3, alto: 2.8, caras: 2 }, // sin caras: 2 por defecto
    ]);
    expect(plano.techos).toEqual([
      { nombre: 'Cochera', largo: 4, ancho: 6, pendiente: 15 },
      { nombre: 'Corredor', largo: 2.5, ancho: 8, pendiente: 15, estimado: true },
    ]);
    expect(plano.losas).toEqual([{ nombre: 'Contrapiso cochera', largo: 6, ancho: 4, espesorCm: 8 }]);
    expect(plano.tubos).toEqual([
      { material: 'Tubo 2x2 galvanizado', medida: 2, cortes: 6 },
      { material: 'Tubo 1x1', medida: 1.2, cortes: 14 },
    ]);
    expect(plano.aberturas).toEqual([{ tipo: 'Puerta', nombre: 'Portón principal', ancho: 3, alto: 2, cantidad: 1 }]);
    expect(plano.notas).toEqual(['Lleva malla ciclón abajo.']);
    expect(ignoradas).toEqual(['LOSA: Acera | 6 | 1']); // a la losa le falta el espesor

    const c = calcularPlano({ ...plano, altoParedes: 2.8 });
    expect(c.paredesNuevasM2).toBe(33.6); // 6 × 2.8 + 3 × 2.8 × 2
    expect(c.techos[0].area).toBe(24.27); // igual que la calculadora de techos
    expect(c.losaM3).toBe(1.92); // 6 × 4 × 0.08
    expect(c.tuboMetros).toBe(28.8); // 2 × 6 + 1.2 × 14
    expect(c.hayEstimados).toBe(true);
  });
});

describe('Áreas por tipo', async () => {
  const { areas } = await import('../src/lib/calculadoras.ts');
  it('separa paredes, pisos y techos; puertas y ventanas solo se restan de las paredes', () => {
    const r = areas(
      [
        { descripcion: 'Paredes', largo: 15, alto: 2.5, cantidad: 1, tipo: 'Pared' },
        { descripcion: 'Piso', largo: 3.5, alto: 4, cantidad: 1, tipo: 'Piso' },
        { descripcion: 'Cielo', largo: 3.5, alto: 4, cantidad: 1, tipo: 'Techo' },
      ],
      [{ descripcion: 'Puerta', largo: 0.9, alto: 2.1, cantidad: 1 }],
    );
    expect(r.porTipo).toEqual({ Pared: 35.61, Piso: 14, Techo: 14, Otro: 0 });
    expect(r.paredBruta).toBe(37.5); // antes de restar la puerta
    expect(r.neta).toBe(37.5 + 28 - 1.89);
    expect(r.resultado.renglon).toBe('Área total: 63.61 m² (paredes 35.61 m², pisos 14 m², techos y cielos 14 m²).');
  });
  it('sin tipo cuenta como pared (como antes)', () => {
    const r = areas([{ descripcion: '', largo: 4, alto: 2.5, cantidad: 1 }], []);
    expect(r.porTipo.Pared).toBe(10);
    expect(r.resultado.renglon).toBe('Área total: 10 m².');
  });
});
