/**
 * Las 9 calculadoras de obra (sección 7 de la especificación). Solo cuentas: reciben
 * números y devuelven el renglón de resumen, los materiales y (mano de obra) el monto.
 * Los nombres de materiales son los del Catálogo, para que tomen su precio solos.
 */
import { colones } from './formato.ts';
import type { Mezcla } from './tipos.ts';

export interface ResultadoMaterial {
  material: string;
  cantidad: number;
  unidad: string;
  /** Si se agrega a la cotización (la persona lo puede cambiar). */
  agregar: boolean;
  /** Lo que dio la cuenta, cuando la persona pidió de más o de menos (cantidad = lo que pide). */
  calculado?: number;
}

export interface Resultado {
  renglon: string;
  materiales: ResultadoMaterial[];
  /** Solo la calculadora de mano de obra. */
  monto?: number;
  /** Datos que se muestran pero no se agregan (ej. agua). */
  extras?: { etiqueta: string; valor: string }[];
}

export type Rendimientos = Record<string, number>;

/** Redondear hacia arriba sin que 10.0000001 se vuelva 11. */
export const arriba = (x: number): number => Math.ceil(Math.round(x * 1e6) / 1e6);
const dos = (x: number): number => Math.round(x * 100) / 100;
/** Número para los renglones: "12.5" o "1,250". */
export const num = (x: number): string => x.toLocaleString('en-US', { maximumFractionDigits: 2 });
const pos = (x: number): number => (Number.isFinite(x) && x > 0 ? x : 0);

export const NOMBRES = {
  pinturaCubeta: 'Pintura (cubeta)',
  pinturaGalon: 'Pintura (galón)',
  sellador: 'Sellador (galón)',
  rodillo: 'Rodillo 9" antigoteo',
  brocha: 'Brocha 2"',
  durock: 'Lámina Durock 1,22 x 2,44 m de 1/2"',
  stud: 'Stud calibre 22',
  track: 'Track calibre 22',
  tornilloDurock: 'Tornillo punta broca 1 1/4"',
  malla: 'Malla de fibra de vidrio 2"',
  repello: 'Repello SUR fino blanco',
  esquinero: 'Esquinero plástico para gypsum',
  pegamento: 'Pegamento para cerámica',
  fragua: 'Fragua',
  cemento: 'Cemento',
  arena: 'Arena',
  piedra: 'Piedra quintilla',
  policarbonato: 'Lámina de policarbonato',
  tornilloTecho: 'Tornillo de techo',
  canoa: 'Canoa',
};

// 1. Áreas -------------------------------------------------------------------

/** Para qué es cada superficie de "Áreas". */
export const TIPOS_AREA = ['Pared', 'Piso', 'Techo', 'Otro'] as const;
export type TipoArea = (typeof TIPOS_AREA)[number];

export interface Superficie {
  descripcion: string;
  largo: number;
  alto: number;
  cantidad: number;
  /** Para qué es (si no se dice, cuenta como pared). */
  tipo?: TipoArea;
}

/**
 * Áreas por tipo. Las puertas y ventanas se restan solo de las paredes
 * (si no hay paredes, del total).
 */
export function areas(superficies: Superficie[], aberturas: Superficie[]) {
  const m2 = (x: Superficie) => pos(x.largo) * pos(x.alto) * pos(x.cantidad);
  const bruta = dos(superficies.reduce((s, x) => s + m2(x), 0));
  const huecos = dos(aberturas.reduce((s, x) => s + m2(x), 0));
  const neta = dos(Math.max(0, bruta - huecos));
  const porTipo = Object.fromEntries(TIPOS_AREA.map((t) => [t, 0])) as Record<TipoArea, number>;
  for (const x of superficies) porTipo[x.tipo ?? 'Pared'] += m2(x);
  if (porTipo.Pared > 0) porTipo.Pared = Math.max(0, porTipo.Pared - huecos);
  for (const t of TIPOS_AREA) porTipo[t] = dos(porTipo[t]);
  const partes = TIPOS_AREA.filter((t) => porTipo[t] > 0).map((t) => `${PLURAL_AREA[t].toLowerCase()} ${num(porTipo[t])} m²`);
  return {
    bruta,
    aberturas: huecos,
    neta,
    porTipo,
    resultado: { renglon: `Área total: ${num(neta)} m²${partes.length > 1 ? ` (${partes.join(', ')})` : ''}.`, materiales: [] } as Resultado,
  };
}

export const PLURAL_AREA: Record<TipoArea, string> = { Pared: 'Paredes', Piso: 'Pisos', Techo: 'Techos y cielos', Otro: 'Otras áreas' };

// 2. Pintura -----------------------------------------------------------------

export function pintura(e: { m2: number; manos: number; sellador: boolean; desperdicio: number }, r: Rendimientos): Resultado {
  const m2 = pos(e.m2);
  const galones = (m2 * pos(e.manos)) / r.pinturaM2PorGalonPorMano * (1 + pos(e.desperdicio));
  const porCubeta = r.galonesPorCubeta;
  const cubetas = Math.floor(Math.round((galones / porCubeta) * 1e6) / 1e6);
  const sueltos = arriba(galones - cubetas * porCubeta);
  return {
    renglon: `Pintura de ${num(m2)} m² a ${num(pos(e.manos))} manos.`,
    materiales: [
      { material: NOMBRES.pinturaCubeta, cantidad: cubetas, unidad: 'cubeta', agregar: true },
      { material: NOMBRES.pinturaGalon, cantidad: sueltos, unidad: 'galón', agregar: true },
      { material: NOMBRES.sellador, cantidad: e.sellador ? arriba((m2 / r.selladorM2PorGalon) * (1 + pos(e.desperdicio))) : 0, unidad: 'galón', agregar: true },
      { material: NOMBRES.rodillo, cantidad: 1, unidad: 'unid', agregar: false },
      { material: NOMBRES.brocha, cantidad: 1, unidad: 'unid', agregar: false },
    ],
    extras: [{ etiqueta: 'Pintura necesaria', valor: `${num(dos(galones))} galones` }],
  };
}

// 3. Paredes en Durock / gypsum ------------------------------------------------

export function durock(
  e: { largo: number; alto: number; caras: number; aberturas: number; separacion: number; esquineros: number; repello: boolean; desperdicio: number },
  r: Rendimientos,
): Resultado {
  const largo = pos(e.largo);
  const alto = pos(e.alto);
  const m2 = Math.max(0, largo * alto - pos(e.aberturas)) * pos(e.caras);
  const laminas = arriba((m2 / r.m2PorLamina) * (1 + pos(e.desperdicio)));
  const studs = e.separacion > 0 && largo > 0 ? (arriba(largo / e.separacion) + 1) * arriba(alto / r.largoStudTrack) : 0;
  return {
    renglon: `Pared en Durock de ${num(largo)} m x ${num(alto)} m (${num(pos(e.caras))} ${e.caras === 1 ? 'cara' : 'caras'}): ${num(dos(m2))} m².`,
    materiales: [
      { material: NOMBRES.durock, cantidad: laminas, unidad: 'lámina', agregar: true },
      { material: NOMBRES.stud, cantidad: studs, unidad: 'unid', agregar: true },
      { material: NOMBRES.track, cantidad: arriba((2 * largo) / r.largoStudTrack), unidad: 'unid', agregar: true },
      { material: NOMBRES.tornilloDurock, cantidad: laminas * r.tornillosPorLamina, unidad: 'unid', agregar: true },
      { material: NOMBRES.malla, cantidad: arriba((m2 * r.mallaMPorM2) / r.metrosPorRolloMalla), unidad: 'rollo', agregar: true },
      { material: NOMBRES.repello, cantidad: e.repello ? arriba(m2 / r.repelloM2PorSaco) : 0, unidad: 'saco', agregar: true },
      { material: NOMBRES.esquinero, cantidad: Math.round(pos(e.esquineros)), unidad: 'unid', agregar: true },
    ],
    extras: [{ etiqueta: 'Área a forrar', valor: `${num(dos(m2))} m²` }],
  };
}

// 3b. Paredes con cara interna y cara externa ---------------------------------

export interface Cara {
  lleva: boolean;
  /** m² de esta cara (ya sin aberturas). */
  m2: number;
  lamina: string;
  repello: boolean;
}

/**
 * Paredes de gypsum / Durock con cada cara por aparte (cada una con su lámina).
 * La estructura (studs y tracks) sale del largo y el alto, si se dieron.
 */
export function paredes(
  e: { largo: number; alto: number; separacion: number; esquineros: number; desperdicio: number; interna: Cara; externa: Cara },
  r: Rendimientos,
): Resultado {
  const largo = pos(e.largo);
  const alto = pos(e.alto);
  const caras = [
    { nombre: 'interna', ...e.interna },
    { nombre: 'externa', ...e.externa },
  ].filter((c) => c.lleva && pos(c.m2) > 0);
  const totalM2 = caras.reduce((s, c) => s + c.m2, 0);
  const materiales: ResultadoMaterial[] = [];

  // Láminas: se juntan las caras que usan la misma lámina y se redondea una sola vez.
  const porLamina = new Map<string, number>();
  for (const c of caras) {
    const nombre = c.lamina.trim() || NOMBRES.durock;
    porLamina.set(nombre, (porLamina.get(nombre) ?? 0) + c.m2);
  }
  let laminas = 0;
  for (const [nombre, m2] of porLamina) {
    const cant = arriba((m2 / r.m2PorLamina) * (1 + pos(e.desperdicio)));
    laminas += cant;
    materiales.push({ material: nombre, cantidad: cant, unidad: 'lámina', agregar: true });
  }

  const studs = e.separacion > 0 && largo > 0 && alto > 0 ? (arriba(largo / e.separacion) + 1) * arriba(alto / r.largoStudTrack) : 0;
  const m2Repello = caras.filter((c) => c.repello).reduce((s, c) => s + c.m2, 0);
  materiales.push(
    { material: NOMBRES.stud, cantidad: studs, unidad: 'unid', agregar: true },
    { material: NOMBRES.track, cantidad: largo > 0 ? arriba((2 * largo) / r.largoStudTrack) : 0, unidad: 'unid', agregar: true },
    { material: NOMBRES.tornilloDurock, cantidad: laminas * r.tornillosPorLamina, unidad: 'unid', agregar: true },
    { material: NOMBRES.malla, cantidad: arriba((totalM2 * r.mallaMPorM2) / r.metrosPorRolloMalla), unidad: 'rollo', agregar: true },
    { material: NOMBRES.repello, cantidad: arriba(m2Repello / r.repelloM2PorSaco), unidad: 'saco', agregar: true },
    { material: NOMBRES.esquinero, cantidad: Math.round(pos(e.esquineros)), unidad: 'unid', agregar: true },
  );

  const corta = (n: string) => n.replace(/\s*1,22.*$/, '').replace(/^Lámina\s+(de\s+)?/i, '').trim() || n;
  const partes = caras.map((c) => `cara ${c.nombre} en ${corta(c.lamina.trim() || NOMBRES.durock)} (${num(dos(c.m2))} m²)`);
  const medida = largo > 0 && alto > 0 ? `Pared de ${num(largo)} m x ${num(alto)} m` : 'Paredes';
  return {
    renglon: partes.length ? `${medida}: ${partes.join(' y ')}.` : `${medida}: sin caras para forrar.`,
    materiales,
    extras: [
      ...caras.map((c) => ({ etiqueta: `Cara ${c.nombre}`, valor: `${num(dos(c.m2))} m²` })),
      { etiqueta: 'Total a forrar', valor: `${num(dos(totalM2))} m²` },
      ...(studs === 0 ? [{ etiqueta: 'Studs y tracks', valor: 'escribí el largo y el alto para calcularlos' }] : []),
    ],
  };
}

// 4. Cerámica ----------------------------------------------------------------

export function ceramica(e: { m2: number; desperdicio: number; m2PorCaja: number; nombre: string }, r: Rendimientos): Resultado {
  const m2 = pos(e.m2);
  const comprar = m2 * (1 + pos(e.desperdicio));
  return {
    renglon: `Instalación de cerámica: ${num(m2)} m².`,
    materiales: [
      { material: e.nombre.trim() || 'Cerámica', cantidad: e.m2PorCaja > 0 ? arriba(comprar / e.m2PorCaja) : 0, unidad: 'caja', agregar: false },
      { material: NOMBRES.pegamento, cantidad: arriba(m2 / r.ceramicaM2PorSacoPegamento), unidad: 'saco', agregar: true },
      { material: NOMBRES.fragua, cantidad: arriba(m2 / r.ceramicaM2PorBolsaFragua), unidad: 'bolsa', agregar: true },
    ],
    extras: [{ etiqueta: 'm² a comprar', valor: `${num(dos(comprar))} m²` }],
  };
}

// 5. Concreto, chorreas y mortero ----------------------------------------------

export function concreto(e: { mezcla: Mezcla; largo: number; ancho: number; espesorCm: number; cantidad: number; desperdicio: number }): Resultado {
  const m3 = ((pos(e.largo) * pos(e.ancho) * pos(e.espesorCm)) / 100) * pos(e.cantidad) * (1 + pos(e.desperdicio));
  const mz = e.mezcla;
  return {
    renglon: `${mz.tipo} de ${num(pos(e.largo))} m x ${num(pos(e.ancho))} m x ${num(pos(e.espesorCm))} cm: ${num(dos(m3))} m³.`,
    materiales: [
      { material: NOMBRES.cemento, cantidad: arriba(m3 * mz.cemento), unidad: 'saco', agregar: true },
      { material: NOMBRES.arena, cantidad: dos(m3 * mz.arena), unidad: 'm³', agregar: true },
      { material: NOMBRES.piedra, cantidad: dos(m3 * mz.piedra), unidad: 'm³', agregar: true },
    ],
    extras: [
      { etiqueta: 'Volumen', valor: `${num(dos(m3))} m³` },
      { etiqueta: 'Agua (referencia)', valor: `${num(Math.round(m3 * mz.agua))} litros` },
    ],
  };
}

// 6. Techos ------------------------------------------------------------------

export function techo(
  e: { largo: number; ancho: number; pendiente: number; largoLamina: number; anchoUtil: number; lamina: string; canoa: boolean },
  r: Rendimientos,
): Resultado {
  const inclinado = pos(e.largo) * Math.sqrt(1 + pos(e.pendiente) ** 2);
  const area = inclinado * pos(e.ancho);
  const traslape = r.techoTraslape;
  const util = e.largoLamina - traslape;
  const filas = inclinado > 0 && util > 0 ? Math.max(1, arriba((inclinado - traslape) / util)) : 0;
  const porFila = e.anchoUtil > 0 ? arriba(pos(e.ancho) / e.anchoUtil) : 0;
  const laminas = filas * porFila;
  return {
    renglon: `Techo de ${num(dos(area))} m² (${laminas} ${laminas === 1 ? 'lámina' : 'láminas'}).`,
    materiales: [
      { material: e.lamina.trim() || NOMBRES.policarbonato, cantidad: laminas, unidad: 'lámina', agregar: true },
      { material: NOMBRES.tornilloTecho, cantidad: laminas * r.techoTornillosPorLamina, unidad: 'unid', agregar: true },
      { material: NOMBRES.canoa, cantidad: e.canoa ? dos(pos(e.ancho)) : 0, unidad: 'm', agregar: true },
    ],
    extras: [
      { etiqueta: 'Largo inclinado', valor: `${num(dos(inclinado))} m` },
      { etiqueta: 'Filas × láminas por fila', valor: `${filas} × ${porFila}` },
    ],
  };
}

// 7. Estructura metálica -------------------------------------------------------

export interface Corte {
  material: string;
  medida: number;
  cortes: number;
  largoPieza: number;
}

export function estructura(filas: Corte[], desperdicio: number): Resultado {
  const porMaterial = new Map<string, number>();
  let metros = 0;
  for (const f of filas) {
    const lineal = pos(f.medida) * pos(f.cortes);
    if (!f.material.trim() || lineal <= 0 || !(f.largoPieza > 0)) continue;
    metros += lineal;
    const piezas = arriba((lineal * (1 + pos(desperdicio))) / f.largoPieza);
    porMaterial.set(f.material.trim(), (porMaterial.get(f.material.trim()) ?? 0) + piezas);
  }
  return {
    renglon: `Estructura metálica: ${num(dos(metros))} m lineales de tubo.`,
    materiales: [...porMaterial].map(([material, cantidad]) => ({ material, cantidad, unidad: 'unid', agregar: true })),
    extras: [{ etiqueta: 'Metros lineales', valor: `${num(dos(metros))} m` }],
  };
}

// 8. Mano de obra --------------------------------------------------------------

export type FormaManoObra = 'Por hora' | 'Por m²' | 'Por metro lineal' | 'Por día' | 'Precio fijo';

export function manoDeObra(e: { forma: FormaManoObra; cantidad: number; precio: number; personas: number; imprevistos: number }): Resultado {
  const cant = pos(e.cantidad);
  const precio = pos(e.precio);
  const personas = Math.max(1, Math.round(pos(e.personas)) || 1);
  const conPersonas = e.forma === 'Por hora' || e.forma === 'Por día';
  const base = e.forma === 'Precio fijo' ? precio : cant * precio * (conPersonas ? personas : 1);
  const monto = Math.round(base * (1 + pos(e.imprevistos)));
  const p = `${personas} ${personas === 1 ? 'persona' : 'personas'}`;
  const renglon = {
    'Por hora': `Se trabajan ${num(cant)} horas a ${colones(precio)} por hora (${p}).`,
    'Por m²': `Trabajo de ${num(cant)} m².`,
    'Por metro lineal': `Trabajo de ${num(cant)} metros lineales.`,
    'Por día': `${num(cant)} ${cant === 1 ? 'día' : 'días'} de trabajo con ${p}.`,
    'Precio fijo': 'Trabajo a precio fijo.',
  }[e.forma];
  return { renglon, materiales: [], monto };
}

// 9. Conversiones --------------------------------------------------------------

export function conversiones(valor: number, metrosPorVara: number) {
  const v = Number.isFinite(valor) ? valor : 0;
  return [
    { de: 'pulgadas', a: 'cm', valor: v * 2.54 },
    { de: 'cm', a: 'pulgadas', valor: v / 2.54 },
    { de: 'pies', a: 'm', valor: v * 0.3048 },
    { de: 'm', a: 'pies', valor: v / 0.3048 },
    { de: 'm²', a: 'varas²', valor: v / metrosPorVara ** 2 },
    { de: 'varas²', a: 'm²', valor: v * metrosPorVara ** 2 },
    { de: 'varas', a: 'm', valor: v * metrosPorVara },
    { de: 'galones', a: 'litros', valor: v * 3.785 },
  ];
}

// 10. Pisos ------------------------------------------------------------------

export interface Espacio {
  nombre: string;
  largo: number;
  ancho: number;
}

export interface OpcionesPiso {
  ceramica: boolean;
  desperdicio: number;
  m2PorCaja: number;
  nombreCeramica: string;
  rodapie: boolean;
  /** Ancho total de puertas: ahí no va rodapié. */
  anchoPuertas: number;
  contrapiso: boolean;
  mezcla: Mezcla | null;
  espesorCm: number;
  desperdicioConcreto: number;
}

/** Piso por espacios: área total y, según lo que lleve, cerámica, rodapié y contrapiso. */
export function pisos(espacios: Espacio[], o: OpcionesPiso, r: Rendimientos): Resultado {
  const validos = espacios.filter((e) => pos(e.largo) > 0 && pos(e.ancho) > 0);
  const area = dos(validos.reduce((s, e) => s + e.largo * e.ancho, 0));
  const perimetro = dos(validos.reduce((s, e) => s + 2 * (e.largo + e.ancho), 0));
  const rodapieM = dos(Math.max(0, perimetro - pos(o.anchoPuertas)));
  const materiales: ResultadoMaterial[] = [];
  const extras: { etiqueta: string; valor: string }[] = [
    { etiqueta: 'Área total de piso', valor: `${num(area)} m²` },
    { etiqueta: 'Perímetro total', valor: `${num(perimetro)} m` },
  ];
  if (o.ceramica) {
    const c = ceramica({ m2: area, desperdicio: o.desperdicio, m2PorCaja: o.m2PorCaja, nombre: o.nombreCeramica }, r);
    materiales.push(...c.materiales);
    extras.push(...(c.extras ?? []));
  }
  if (o.rodapie) {
    materiales.push({ material: 'Rodapié', cantidad: arriba(rodapieM * (1 + pos(o.desperdicio))), unidad: 'm', agregar: true });
    extras.push({ etiqueta: 'Rodapié (sin contar puertas)', valor: `${num(rodapieM)} m` });
  }
  if (o.contrapiso && o.mezcla && area > 0) {
    const c = concreto({ mezcla: o.mezcla, largo: area, ancho: 1, espesorCm: o.espesorCm, cantidad: 1, desperdicio: o.desperdicioConcreto });
    materiales.push(...c.materiales);
    extras.push(...(c.extras ?? []).map((x) => (x.etiqueta === 'Volumen' ? { etiqueta: 'Concreto del contrapiso', valor: x.valor } : x)));
  }
  const que = [o.ceramica ? 'cerámica' : '', o.contrapiso ? `contrapiso de ${num(pos(o.espesorCm))} cm` : ''].filter(Boolean).join(' y ');
  return {
    renglon: `Piso${que ? ' (' + que + ')' : ''}: ${num(area)} m² en ${validos.length} ${validos.length === 1 ? 'espacio' : 'espacios'}.`,
    materiales,
    extras,
  };
}
