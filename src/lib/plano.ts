/**
 * Plano: todo lo que se puede cotizar de un plano (espacios, paredes, puertas, ventanas,
 * techos, losas/chorreas y tubos de estructura metálica) y sus cálculos.
 * Las medidas se escriben a mano o se pegan desde un chat de IA gratis (ChatGPT, Gemini,
 * Claude…) que leyó el plano siguiendo la instrucción general de abajo.
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

export interface Pared {
  nombre: string;
  largo: number;
  alto: number;
  /** Caras a forrar o repellar: 1 o 2. */
  caras: number;
  estimado?: boolean;
}

export interface Techo {
  nombre: string;
  /** Largo de caída, medido en horizontal. */
  largo: number;
  /** Frente o ancho. */
  ancho: number;
  /** Pendiente en % (15 = 15 %). */
  pendiente: number;
  estimado?: boolean;
}

export interface Losa {
  nombre: string;
  largo: number;
  ancho: number;
  espesorCm: number;
  estimado?: boolean;
}

export interface Tubo {
  material: string;
  medida: number;
  cortes: number;
  estimado?: boolean;
}

export interface Plano {
  altoParedes: number;
  cuartos: Cuarto[];
  aberturas: Abertura[];
  paredes: Pared[];
  techos: Techo[];
  losas: Losa[];
  tubos: Tubo[];
  notas: string[];
}

export const planoVacio = (): Plano => ({ altoParedes: 0, cuartos: [], aberturas: [], paredes: [], techos: [], losas: [], tubos: [], notas: [] });

/** Instrucción general: sirve para cualquier plano. Se copia y se pega en el chat junto con la imagen. */
export const INSTRUCCION_CHAT = [
  'Sos un asistente para cotizar trabajos de construcción en Costa Rica. Te voy a mandar un plano, croquis o foto con medidas de un trabajo: puede ser una casa, un cuarto, una pared, un piso, un techo, una chorrea o losa, un portón, una jaula, una estructura metálica, o varias cosas juntas.',
  '',
  'Leé TODAS las medidas que sirvan para calcular materiales y respondeme SOLO con líneas en este formato. Usá únicamente los tipos que apliquen a este plano y no escribas nada más (sin explicaciones, sin tablas, sin títulos):',
  '',
  'ALTO: <alto general de las paredes en metros>',
  'ESPACIO: <nombre> | <largo en m> | <ancho en m>',
  'PARED: <nombre> | <largo en m> | <alto en m> | <caras a forrar o repellar: 1 o 2>',
  'PUERTA: <nombre> | <ancho en m> | <alto en m> | <cantidad>',
  'VENTANA: <nombre> | <ancho en m> | <alto en m> | <cantidad>',
  'TECHO: <nombre> | <largo de caída en m, medido en horizontal> | <frente en m> | <pendiente en %>',
  'LOSA: <nombre> | <largo en m> | <ancho en m> | <espesor en cm>',
  'TUBO: <tipo y medida del tubo o perfil> | <largo de cada corte en m> | <cantidad de cortes>',
  'NOTA: <algo importante para cotizar que no cabe en las líneas anteriores>',
  '',
  'Qué va en cada tipo:',
  '- ESPACIO: cada cuarto o área de piso (cuartos, baño, cocina, closet, pasillo, cochera…).',
  '- PARED: solo paredes NUEVAS que hay que construir o forrar (no pongas las que el plano marca como existentes).',
  '- TECHO: cada agua o sección de techo.',
  '- LOSA: chorreas, contrapisos, aceras, losas, bases o placas de concreto.',
  '- TUBO: cada pieza de una estructura metálica (portones, jaulas, marcos, cerchas, verjas); una línea por cada medida de corte distinta.',
  '',
  'Reglas:',
  '- Todo en metros, con punto decimal (ej. 3.50). El espesor de LOSA va en centímetros.',
  '- Si una medida no viene escrita, calculala con las demás y poné (estimado) al final de esa línea.',
  '- Si no se ve: alto de paredes 2.50, alto de puerta 2.10, alto de ventana 1.00, pendiente de techo 15 (todas con (estimado)).',
  '',
  'Ejemplo:',
  'ALTO: 2.50',
  'ESPACIO: Cuarto principal | 3.50 | 4.00',
  'PARED: Pared nueva del baño | 2.25 | 2.50 | 2',
  'PUERTA: Puerta de cuarto | 1.05 | 2.10 | 2',
  'VENTANA: Ventana del cuarto | 2.00 | 1.00 | 1 (estimado)',
  'TECHO: Techo de cochera | 4.00 | 6.00 | 15',
  'LOSA: Acera | 6.00 | 1.00 | 8',
  'TUBO: Tubo 2x2 galvanizado | 2.00 | 6',
  'NOTA: El portón lleva malla ciclón en la parte de abajo.',
].join('\n');

const numero = (t: string | undefined): number | null => {
  if (!t) return null;
  const m = /-?\d+(?:[.,]\d+)?/.exec(t);
  return m ? Number(m[0].replace(',', '.')) : null;
};

const TIPOS: Record<string, keyof Plano | 'alto'> = {
  alto: 'alto',
  cuarto: 'cuartos',
  espacio: 'cuartos',
  area: 'cuartos',
  área: 'cuartos',
  pared: 'paredes',
  muro: 'paredes',
  puerta: 'aberturas',
  porton: 'aberturas',
  ventana: 'aberturas',
  techo: 'techos',
  losa: 'losas',
  chorrea: 'losas',
  contrapiso: 'losas',
  tubo: 'tubos',
  perfil: 'tubos',
  nota: 'notas',
};

/**
 * Lee la respuesta del chat. Acepta mayúsculas o minúsculas, plurales, "|" o ";" como
 * separador, coma o punto decimal, viñetas o negritas (**PARED:**) y "Baño 2.25 x 2.20".
 */
export function leerRespuesta(texto: string): { plano: Plano; ignoradas: string[] } {
  const plano = planoVacio();
  const ignoradas: string[] = [];
  for (const cruda of texto.split(/\r?\n/)) {
    const linea = cruda
      .replace(/[*_]/g, '')
      .replace(/^\s*[-•·>]\s*/, '')
      .trim();
    if (!linea) continue;
    const m = /^([a-záéíóúñ]+?)(?:es|s)?\s*[:-]\s*(.*)$/i.exec(linea);
    const palabra = m?.[1].toLowerCase() ?? '';
    const destino = TIPOS[palabra] ?? TIPOS[palabra.normalize('NFD').replace(/[̀-ͯ]/g, '')];
    if (!m || !destino) {
      ignoradas.push(cruda.trim());
      continue;
    }
    if (destino === 'notas') {
      if (m[2].trim()) plano.notas.push(m[2].trim());
      continue;
    }
    const estimado = /estimad/i.test(m[2]);
    const resto = m[2].replace(/\(?\s*estimad[oa]s?\s*\)?/gi, '').trim();
    const marca = estimado ? { estimado } : {};
    if (destino === 'alto') {
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
    const n3 = numero(c);
    if (n1 === null || n2 === null || n1 <= 0 || n2 <= 0) {
      ignoradas.push(cruda.trim());
      continue;
    }
    switch (destino) {
      case 'cuartos':
        plano.cuartos.push({ nombre: nombre || `Espacio ${plano.cuartos.length + 1}`, largo: n1, ancho: n2, ...marca });
        break;
      case 'paredes':
        plano.paredes.push({ nombre: nombre || `Pared ${plano.paredes.length + 1}`, largo: n1, alto: n2, caras: n3 === 1 ? 1 : 2, ...marca });
        break;
      case 'aberturas': {
        const tipo = palabra === 'ventana' ? 'Ventana' : 'Puerta';
        plano.aberturas.push({ tipo, nombre: nombre || tipo, ancho: n1, alto: n2, cantidad: n3 && n3 > 0 ? Math.round(n3) : 1, ...marca });
        break;
      }
      case 'techos':
        plano.techos.push({ nombre: nombre || `Techo ${plano.techos.length + 1}`, largo: n1, ancho: n2, pendiente: n3 !== null && n3 >= 0 ? n3 : 15, ...marca });
        break;
      case 'losas':
        if (n3 === null || n3 <= 0) {
          ignoradas.push(cruda.trim());
          break;
        }
        plano.losas.push({ nombre: nombre || `Losa ${plano.losas.length + 1}`, largo: n1, ancho: n2, espesorCm: n3, ...marca });
        break;
      case 'tubos':
        plano.tubos.push({ material: nombre || 'Tubo', medida: n1, cortes: Math.round(n2), ...marca });
        break;
    }
  }
  return { plano, ignoradas };
}

const dos = (x: number) => Math.round(x * 100) / 100;

/** Piso, perímetros, paredes, techos, losas y tubos del plano. */
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
  const paredes = p.paredes.filter((w) => w.largo > 0 && w.alto > 0);
  const paredesNuevasM2 = dos(paredes.reduce((s, w) => s + w.largo * w.alto * w.caras, 0));
  const techos = p.techos
    .filter((t) => t.largo > 0 && t.ancho > 0)
    .map((t) => ({ ...t, area: dos(t.largo * Math.sqrt(1 + (t.pendiente / 100) ** 2) * t.ancho) }));
  const losas = p.losas
    .filter((l) => l.largo > 0 && l.ancho > 0 && l.espesorCm > 0)
    .map((l) => ({ ...l, m3: dos((l.largo * l.ancho * l.espesorCm) / 100) }));
  const tubos = p.tubos.filter((t) => t.medida > 0 && t.cortes > 0);
  return {
    cuartos,
    area,
    perimetro,
    paredesBrutas,
    huecos,
    paredesNetas: dos(Math.max(0, paredesBrutas - huecos)),
    anchoPuertas,
    paredes,
    paredesNuevasM2,
    techos,
    techoM2: dos(techos.reduce((s, t) => s + t.area, 0)),
    losas,
    losaM3: dos(losas.reduce((s, l) => s + l.m3, 0)),
    tubos,
    tuboMetros: dos(tubos.reduce((s, t) => s + t.medida * t.cortes, 0)),
    hayEstimados: [p.cuartos, p.aberturas, p.paredes, p.techos, p.losas, p.tubos].some((l) => l.some((x) => x.estimado)),
  };
}
