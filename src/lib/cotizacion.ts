/**
 * Reglas de una cotización: ordenar los datos, número siguiente, cálculos (sección 5
 * de la especificación) y cláusulas con sus palabras automáticas.
 */
import { colones, porcentaje, sumarDias, hoyISO } from './formato.ts';
import type { Ajustes, Clausula, Cotizacion, DatosCotizacion, FilaMaterial, Material, Parte, Version } from './tipos.ts';

const texto = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown, def: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const numONulo = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const si = (v: unknown, def = true): boolean => (typeof v === 'boolean' ? v : def);

/**
 * Junta los bloques "continuación" de las cotizaciones viejas (Parte sin nombre que
 * sigue a la de arriba) en una sola Parte con todos sus renglones, y quita lo vacío.
 */
export function normalizarPartes(v: unknown): Parte[] {
  if (!Array.isArray(v)) return [];
  const res: Parte[] = [];
  for (const p of v) {
    const nombre = texto(p?.nombre).trim();
    const monto = numONulo(p?.monto);
    const renglones = (Array.isArray(p?.renglones) ? p.renglones : [])
      .map((r: { texto?: unknown; clienteVe?: unknown }) => ({ texto: texto(r?.texto), clienteVe: si(r?.clienteVe) }))
      .filter((r: { texto: string }) => r.texto.trim() !== '');
    const anterior = res[res.length - 1];
    if (!nombre && anterior) {
      anterior.renglones.push(...renglones);
      if (monto !== null) anterior.monto = (anterior.monto ?? 0) + monto;
      continue;
    }
    if (!nombre && !renglones.length && monto === null) continue;
    res.push({ nombre, monto, renglones });
  }
  return res;
}

function normalizarMateriales(v: unknown): FilaMaterial[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((m) => texto(m?.material).trim())
    .map((m) => ({
      material: texto(m.material).trim(),
      cantidad: typeof m.cantidad === 'number' && Number.isFinite(m.cantidad) ? m.cantidad : texto(m.cantidad) || null,
      unidad: texto(m.unidad),
      precioEspecial: numONulo(m.precioEspecial),
      clienteVe: si(m.clienteVe),
    }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizarDatos(d: any): DatosCotizacion {
  d ??= {};
  const cv = d.clienteVe ?? {};
  return {
    numero: texto(d.numero),
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(texto(d.fecha)) ? d.fecha : hoyISO(),
    cliente: texto(d.cliente),
    telefono: texto(d.telefono),
    ubicacion: texto(d.ubicacion),
    tipoTrabajo: texto(d.tipoTrabajo),
    trabajoSolicitado: texto(d.trabajoSolicitado),
    detalleExtra: texto(d.detalleExtra),
    modoPrecio: d.modoPrecio === 'Partes + materiales' ? 'Partes + materiales' : 'Total a mano',
    totalAMano: numONulo(d.totalAMano),
    cobrarIVA: si(d.cobrarIVA, false),
    porcentajeAdelanto: num(d.porcentajeAdelanto, 0.5),
    quienCompraMateriales: d.quienCompraMateriales === 'Arce Nuñez' ? 'Arce Nuñez' : 'El cliente',
    mostrarMateriales: si(d.mostrarMateriales),
    validezDias: num(d.validezDias, 15),
    garantiaMeses: num(d.garantiaMeses, 3),
    horario: texto(d.horario),
    formaPagoEspecial: texto(d.formaPagoEspecial),
    clienteVe: {
      montoPartes: si(cv.montoPartes),
      preciosMateriales: si(cv.preciosMateriales),
      desglose: si(cv.desglose),
      adelantoSaldo: si(cv.adelantoSaldo),
    },
    partes: normalizarPartes(d.partes),
    materiales: normalizarMateriales(d.materiales),
    notas: (Array.isArray(d.notas) ? d.notas : []).map(texto),
    fotos: (Array.isArray(d.fotos) ? d.fotos : []).filter((f: unknown) => typeof f === 'string' && f),
    extras: (Array.isArray(d.extras) ? d.extras : [])
      .filter((x: { concepto?: unknown }) => texto(x?.concepto).trim())
      .map((x: Record<string, unknown>) => ({ concepto: texto(x.concepto).trim(), monto: numONulo(x.monto), categoria: texto(x.categoria), clienteVe: x.clienteVe === true })),
  };
}

export function normalizarCotizaciones(v: unknown): Cotizacion[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((c) => texto(c?.numero))
    .map((c) => {
      const versiones: Version[] = (Array.isArray(c.versiones) ? c.versiones : [])
        .map((x: Record<string, unknown>) => ({
          ...x,
          version: num(x.version, 1),
          guardado: texto(x.guardado),
          guardadoPor: texto(x.guardadoPor),
          queCambio: texto(x.queCambio),
          total: num(x.total, 0),
          adelanto: num(x.adelanto, 0),
          datos: normalizarDatos(x.datos),
        }))
        .sort((a: Version, b: Version) => a.version - b.version);
      return {
        numero: texto(c.numero),
        cliente: texto(c.cliente) || versiones[versiones.length - 1]?.datos.cliente || '',
        estado: texto(c.estado) || 'Pendiente',
        versionActual: versiones.length ? versiones[versiones.length - 1].version : 0,
        versiones,
        ...(texto(c.notasInternas) ? { notasInternas: texto(c.notasInternas) } : {}),
        ...(texto(c.estadoPor) ? { estadoPor: texto(c.estadoPor), estadoFecha: texto(c.estadoFecha) } : {}),
        ...(texto(c.gastosRegistrados) ? { gastosRegistrados: texto(c.gastosRegistrados) } : {}),
      };
    })
    .filter((c) => c.versiones.length > 0);
}

/** Última versión guardada de una cotización. */
export function ultimaVersion(c: Cotizacion): Version {
  return c.versiones[c.versiones.length - 1];
}

/** Siguiente número: el mayor que exista + 1 (COT-0008 si el mayor es COT-0007). */
export function siguienteNumero(cotizaciones: { numero: string }[], prefijo: string): string {
  let mayor = 0;
  for (const c of cotizaciones) {
    const m = /(\d+)\s*$/.exec(c.numero);
    if (m) mayor = Math.max(mayor, Number(m[1]));
  }
  return `${prefijo}${String(mayor + 1).padStart(4, '0')}`;
}

/** Cotización vacía con los valores por defecto de Ajustes. */
export function datosNuevos(ajustes: Ajustes, numero: string, cliente?: { cliente: string; telefono: string; ubicacion: string }): DatosCotizacion {
  const d = ajustes.porDefecto;
  return normalizarDatos({
    numero,
    fecha: hoyISO(),
    cliente: cliente?.cliente ?? '',
    telefono: cliente?.telefono ?? '',
    ubicacion: cliente?.ubicacion ?? '',
    modoPrecio: d.modoPrecio,
    porcentajeAdelanto: d.porcentajeAdelanto,
    quienCompraMateriales: d.quienCompraMateriales,
    validezDias: d.validezDias,
    garantiaMeses: d.garantiaMeses,
    horario: d.horario,
    cobrarIVA: false,
    mostrarMateriales: true,
    partes: [{ nombre: '', monto: null, renglones: [] }],
  });
}

/** Lista de clientes sin repetir (con los datos de su cotización más reciente). */
export function clientes(cotizaciones: Cotizacion[]): { cliente: string; telefono: string; ubicacion: string; numeros: string[] }[] {
  const mapa = new Map<string, { cliente: string; telefono: string; ubicacion: string; numeros: string[]; fecha: string }>();
  for (const c of cotizaciones) {
    const d = ultimaVersion(c).datos;
    const clave = d.cliente.trim().toLowerCase();
    if (!clave) continue;
    const previo = mapa.get(clave);
    if (!previo) mapa.set(clave, { cliente: d.cliente.trim(), telefono: d.telefono, ubicacion: d.ubicacion, numeros: [c.numero], fecha: d.fecha });
    else {
      previo.numeros.push(c.numero);
      if (d.fecha >= previo.fecha) Object.assign(previo, { telefono: d.telefono || previo.telefono, ubicacion: d.ubicacion || previo.ubicacion, fecha: d.fecha });
    }
  }
  return [...mapa.values()].sort((a, b) => a.cliente.localeCompare(b.cliente, 'es'));
}

// ---------------------------------------------------------------------------
// Cálculos
// ---------------------------------------------------------------------------

export interface FilaCalculada extends FilaMaterial {
  unidadFinal: string;
  precioCatalogo: number | null;
  precioUsado: number | null;
  total: number | null;
}

export interface Calculo {
  manoDeObra: number;
  /** Suma de todos los costos extras (se cobran). */
  extras: number;
  /** Los que el cliente no ve: se meten en "Mano de obra" del desglose para que cuadre. */
  extrasOcultos: number;
  materiales: number;
  subtotal: number;
  iva: number;
  total: number;
  adelanto: number;
  saldo: number;
  validaHasta: string;
  filas: FilaCalculada[];
}

export function cantidadNumero(c: FilaMaterial['cantidad']): number | null {
  if (typeof c === 'number') return Number.isFinite(c) ? c : null;
  if (typeof c === 'string' && /^\s*\d+([.,]\d+)?\s*$/.test(c)) return Number(c.replace(',', '.'));
  return null;
}

export function calcular(d: DatosCotizacion, catalogo: Material[], tasaIva: number): Calculo {
  const porNombre = new Map(catalogo.map((m) => [m.material, m]));
  const filas: FilaCalculada[] = d.materiales.map((f) => {
    const cat = porNombre.get(f.material.trim());
    const precioCatalogo = cat?.precio ?? null;
    const precioUsado = f.precioEspecial ?? precioCatalogo;
    const cant = cantidadNumero(f.cantidad);
    return {
      ...f,
      unidadFinal: f.unidad || cat?.unidad || '',
      precioCatalogo,
      precioUsado,
      total: cant !== null && precioUsado !== null ? Math.round(cant * precioUsado) : null,
    };
  });
  const manoDeObra = d.partes.reduce((s, p) => s + (p.monto ?? 0), 0);
  const materiales = filas.reduce((s, f) => s + (f.total ?? 0), 0);
  const extras = (d.extras ?? []).reduce((s, x) => s + (x.monto ?? 0), 0);
  const extrasOcultos = (d.extras ?? []).filter((x) => !x.clienteVe).reduce((s, x) => s + (x.monto ?? 0), 0);
  const base = d.modoPrecio === 'Total a mano' ? (d.totalAMano ?? 0) : manoDeObra + (d.quienCompraMateriales === 'Arce Nuñez' ? materiales : 0);
  const subtotal = base + extras;
  const iva = d.cobrarIVA ? Math.round(subtotal * tasaIva) : 0;
  const total = subtotal + iva;
  const adelanto = Math.round(total * d.porcentajeAdelanto);
  return { manoDeObra, extras, extrasOcultos, materiales, subtotal, iva, total, adelanto, saldo: total - adelanto, validaHasta: sumarDias(d.fecha, d.validezDias), filas };
}

// ---------------------------------------------------------------------------
// Cláusulas
// ---------------------------------------------------------------------------

const ROMANOS: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

export function romano(n: number): string {
  let r = '';
  for (const [v, s] of ROMANOS) while (n >= v) {
    r += s;
    n -= v;
  }
  return r;
}

/** "la Parte I" / "las Partes I y II" / "las Partes I a V" / "esta cotización". */
export function textoPartes(cantidad: number): string {
  if (cantidad <= 0) return 'esta cotización';
  if (cantidad === 1) return 'la Parte I';
  if (cantidad === 2) return 'las Partes I y II';
  return `las Partes I a ${romano(cantidad)}`;
}

export interface ClausulaFinal {
  titulo: string;
  texto: string;
}

export function clausulasFinales(clausulas: Clausula[], d: DatosCotizacion, c: Calculo, ajustes: Ajustes): ClausulaFinal[] {
  const arceCompra = d.quienCompraMateriales === 'Arce Nuñez';
  const partesConNombre = d.partes.filter((p) => p.nombre.trim()).length;
  const palabras: Record<string, string> = {
    PARTES: textoPartes(partesConNombre),
    COBERTURA: arceCompra ? 'la mano de obra y los materiales' : 'exclusivamente la mano de obra',
    GARANTIA: String(d.garantiaMeses),
    ADELANTO_PCT: porcentaje(d.porcentajeAdelanto),
    ADELANTO: colones(c.adelanto),
    SALDO_PCT: porcentaje(1 - d.porcentajeAdelanto),
    SALDO: colones(c.saldo),
    HORARIO: d.horario,
    PERSONAL: ajustes.empresa.personal,
    VALIDEZ: String(d.validezDias),
    SINPE: ajustes.empresa.sinpe,
    TITULAR: ajustes.empresa.responsable,
    IVA_PCT: porcentaje(ajustes.porDefecto.iva),
  };
  const reemplazar = (t: string) => t.replace(/\{([A-Z_]+)\}/g, (todo, k: string) => palabras[k] ?? todo);

  const res: ClausulaFinal[] = [];
  for (const cl of clausulas) {
    if (!cl.titulo.trim()) continue;
    let t = cl.texto;
    if (cl.condicion === 'MATERIALES' && arceCompra && cl.alternativo.trim()) t = cl.alternativo;
    if (cl.condicion === 'IVA' && d.cobrarIVA && cl.alternativo.trim()) t = cl.alternativo;
    if (cl.condicion === 'PAGO' && d.formaPagoEspecial.trim()) t = d.formaPagoEspecial;
    t = reemplazar(t).trim();
    if (t) res.push({ titulo: cl.titulo.trim(), texto: t });
  }
  return res;
}

// ---------------------------------------------------------------------------
// Historial
// ---------------------------------------------------------------------------

/** Estados que cuentan como "aceptado o en curso" en los indicadores del Historial. */
export const ESTADOS_ACEPTADOS = ['Aceptada', 'En proceso', 'Terminada', 'Pagada'];

export interface FiltroHistorial {
  texto: string;
  estado: string;
  desde: string;
  hasta: string;
}

export function filtrarHistorial(cotizaciones: Cotizacion[], f: FiltroHistorial): Cotizacion[] {
  const q = f.texto.trim().toLowerCase();
  return cotizaciones
    .filter((c) => {
      const d = ultimaVersion(c).datos;
      if (f.estado && c.estado !== f.estado) return false;
      if (f.desde && d.fecha < f.desde) return false;
      if (f.hasta && d.fecha > f.hasta) return false;
      if (q && ![c.numero, c.cliente, d.telefono, d.ubicacion, d.trabajoSolicitado, d.tipoTrabajo, c.notasInternas ?? ''].some((t) => t.toLowerCase().includes(q))) return false;
      return true;
    })
    .sort((a, b) => b.numero.localeCompare(a.numero, 'es', { numeric: true }));
}

export function indicadores(cotizaciones: Cotizacion[]) {
  let cotizado = 0;
  let aceptado = 0;
  let pendientes = 0;
  let montoPendiente = 0;
  for (const c of cotizaciones) {
    const t = ultimaVersion(c).total;
    cotizado += t;
    if (ESTADOS_ACEPTADOS.includes(c.estado)) aceptado += t;
    if (c.estado === 'Pendiente') {
      pendientes++;
      montoPendiente += t;
    }
  }
  return { cantidad: cotizaciones.length, cotizado, aceptado, pendientes, montoPendiente };
}
