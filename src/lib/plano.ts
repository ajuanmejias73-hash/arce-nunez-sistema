/**
 * Plano: medidas de cuartos, puertas y ventanas, y sus cálculos (piso, perímetro, paredes).
 * Las medidas se escriben a mano o se pegan desde un chat de IA gratis (ChatGPT, Gemini,
 * Claude…) que leyó el plano siguiendo la instrucción de abajo.
 */

export interface Cuarto {
  nombre: string;
  largo: number;
  ancho: number;
  estimado?: boolean;
}

export interface Abertura {
  tipo: 'Puerta' | 'Ventana';
  nombre: string;
  ancho: number;
  alto: number;
  cantidad: number;
  estimado?: boolean;
}

export interface Plano {
  altoParedes: number;
  cuartos: Cuarto[];
  aberturas: Abertura[];
}

/** Lo que se copia y se pega en el chat de IA junto con la imagen del plano. */
export const INSTRUCCION_CHAT = [
  'Te voy a mandar un plano de construcción. Leé todas las medidas y respondeme SOLO con estas líneas (sin explicaciones, sin tablas):',
  '',
  'ALTO: <alto de las paredes en metros; si no aparece, poné 2.50>',
  'CUARTO: <nombre> | <largo en metros> | <ancho en metros>',
  'PUERTA: <nombre> | <ancho en metros> | <alto en metros> | <cantidad>',
  'VENTANA: <nombre> | <ancho en metros> | <alto en metros> | <cantidad>',
  '',
  'Reglas:',
  '- Una línea por cada cuarto o espacio (baño, closet, cocina, pasillo…), por cada tipo de puerta y por cada tipo de ventana.',
  '- Usá punto para los decimales (ej. 3.50).',
  '- Si una medida no viene escrita en el plano, calculala con las demás medidas y poné (estimado) al final de esa línea.',
  '- Si no se ve el alto de una puerta, usá 2.10; si no se ve el de una ventana, usá 1.00 y poné (estimado).',
  '',
  'Ejemplo:',
  'ALTO: 2.50',
  'CUARTO: Cuarto principal | 3.50 | 4.00',
  'CUARTO: Baño | 2.25 | 2.20',
  'PUERTA: Puerta de cuarto | 1.05 | 2.10 | 3',
  'VENTANA: Ventana cuarto | 2.00 | 1.00 | 1 (estimado)',
].join('\n');

const numero = (t: string | undefined): number | null => {
  if (!t) return null;
  const m = /-?\d+(?:[.,]\d+)?/.exec(t);
  return m ? Number(m[0].replace(',', '.')) : null;
};

/**
 * Lee la respuesta del chat. Acepta mayúsculas o minúsculas, "|" o ";" como separador,
 * coma o punto decimal, viñetas o negritas (**CUARTO:**) y "Baño 2.25 x 2.20".
 */
export function leerRespuesta(texto: string): { plano: Plano; ignoradas: string[] } {
  const plano: Plano = { altoParedes: 0, cuartos: [], aberturas: [] };
  const ignoradas: string[] = [];
  for (const cruda of texto.split(/\r?\n/)) {
    const linea = cruda
      .replace(/[*_]/g, '')
      .replace(/^\s*[-•·>]\s*/, '')
      .trim();
    if (!linea) continue;
    const m = /^(alto|cuarto|espacio|puerta|ventana)s?\s*[:-]\s*(.*)$/i.exec(linea);
    if (!m) {
      ignoradas.push(cruda.trim());
      continue;
    }
    const tipo = m[1].toLowerCase();
    const estimado = /estimad/i.test(m[2]);
    const resto = m[2].replace(/\(?\s*estimad[oa]s?\s*\)?/gi, '').trim();
    if (tipo === 'alto') {
      const n = numero(resto);
      if (n && n > 0) plano.altoParedes = n;
      else ignoradas.push(cruda.trim());
      continue;
    }
    let partes = resto.split(/[|;]/).map((p) => p.trim());
    if (partes.length === 1) {
      const x = /^(.*?)\s*(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)(.*)$/i.exec(partes[0]);
      if (x) partes = [x[1].trim(), x[2], x[3], x[4].trim()];
    }
    const [nombre, a, b, c] = partes;
    const n1 = numero(a);
    const n2 = numero(b);
    if (n1 === null || n2 === null || n1 <= 0 || n2 <= 0) {
      ignoradas.push(cruda.trim());
      continue;
    }
    if (tipo === 'cuarto' || tipo === 'espacio') {
      plano.cuartos.push({ nombre: nombre || `Espacio ${plano.cuartos.length + 1}`, largo: n1, ancho: n2, ...(estimado ? { estimado } : {}) });
    } else {
      const cant = numero(c);
      plano.aberturas.push({
        tipo: tipo === 'puerta' ? 'Puerta' : 'Ventana',
        nombre: nombre || (tipo === 'puerta' ? 'Puerta' : 'Ventana'),
        ancho: n1,
        alto: n2,
        cantidad: cant && cant > 0 ? Math.round(cant) : 1,
        ...(estimado ? { estimado } : {}),
      });
    }
  }
  return { plano, ignoradas };
}

const dos = (x: number) => Math.round(x * 100) / 100;

/** Piso, perímetro y paredes de cada cuarto y del total. */
export function calcularPlano(p: Plano) {
  const cuartos = p.cuartos
    .filter((c) => c.largo > 0 && c.ancho > 0)
    .map((c) => {
      const perimetro = 2 * (c.largo + c.ancho);
      return { ...c, area: dos(c.largo * c.ancho), perimetro: dos(perimetro), paredes: dos(perimetro * p.altoParedes) };
    });
  const area = dos(cuartos.reduce((s, c) => s + c.area, 0));
  const perimetro = dos(cuartos.reduce((s, c) => s + c.perimetro, 0));
  const paredesBrutas = dos(cuartos.reduce((s, c) => s + c.paredes, 0));
  const aberturas = p.aberturas.filter((a) => a.ancho > 0 && a.alto > 0 && a.cantidad > 0);
  const huecos = dos(aberturas.reduce((s, a) => s + a.ancho * a.alto * a.cantidad, 0));
  const anchoPuertas = dos(aberturas.filter((a) => a.tipo === 'Puerta').reduce((s, a) => s + a.ancho * a.cantidad, 0));
  return {
    cuartos,
    area,
    perimetro,
    paredesBrutas,
    huecos,
    paredesNetas: dos(Math.max(0, paredesBrutas - huecos)),
    anchoPuertas,
    hayEstimados: p.cuartos.some((c) => c.estimado) || p.aberturas.some((a) => a.estimado),
  };
}
