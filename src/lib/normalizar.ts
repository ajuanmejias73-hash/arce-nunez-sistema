/**
 * Completa y ordena los datos leídos del repositorio, para que la página nunca
 * falle si a un archivo le falta algo (por ejemplo, datos viejos o editados a mano).
 */
import type { Ajustes, Clausula, CondicionClausula, Estado, Hora, Material, Movimiento, Servicio, Trabajador } from './tipos.ts';
import { FORMAS_COBRO } from './tipos.ts';

export const COLORES_ESTADO: Record<string, string> = {
  Pendiente: '#B7892B',
  Aceptada: '#2F6F95',
  'En proceso': '#6A55A3',
  Terminada: '#3D8A57',
  Pagada: '#1E6B42',
  Rechazada: '#A8473C',
};

const COLOR_ESTADO_OTRO = '#7A7266';

export const RENDIMIENTOS_POR_DEFECTO: Record<string, number> = {
  pinturaM2PorGalonPorMano: 35,
  galonesPorCubeta: 5,
  selladorM2PorGalon: 40,
  m2PorLamina: 2.9768,
  largoStudTrack: 3.05,
  tornillosPorLamina: 30,
  mallaMPorM2: 1.4,
  metrosPorRolloMalla: 90,
  repelloM2PorSaco: 4,
  ceramicaM2PorSacoPegamento: 4,
  ceramicaM2PorBolsaFragua: 5,
  largoTubo: 6,
  techoTornillosPorLamina: 8,
  techoTraslape: 0.15,
  metrosPorVara: 0.8359,
};

const texto = (v: unknown, def = ''): string => (typeof v === 'string' ? v : def);
const numero = (v: unknown, def: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const numeroONulo = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const listaTextos = (v: unknown, def: string[] = []): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()))] : def;

function estados(v: unknown): Estado[] {
  if (!Array.isArray(v)) return Object.entries(COLORES_ESTADO).map(([nombre, color]) => ({ nombre, color }));
  const vistos = new Set<string>();
  const res: Estado[] = [];
  for (const e of v) {
    const nombre = typeof e === 'string' ? e : texto((e as Estado)?.nombre);
    if (!nombre.trim() || vistos.has(nombre)) continue;
    vistos.add(nombre);
    const color = typeof e === 'object' && /^#[0-9a-f]{6}$/i.test(texto((e as Estado).color)) ? (e as Estado).color : (COLORES_ESTADO[nombre] ?? COLOR_ESTADO_OTRO);
    res.push({ nombre, color });
  }
  return res;
}

const CONDICIONES: CondicionClausula[] = ['', 'MATERIALES', 'IVA', 'PAGO'];

function clausulas(v: unknown): Clausula[] {
  if (!Array.isArray(v)) return [];
  return v.map((c) => {
    const condicion = texto(c?.condicion).toUpperCase() as CondicionClausula;
    return {
      titulo: texto(c?.titulo),
      texto: texto(c?.texto),
      alternativo: texto(c?.alternativo),
      condicion: CONDICIONES.includes(condicion) ? condicion : '',
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizarAjustes(a: any): Ajustes {
  a ??= {};
  const e = a.empresa ?? {};
  const d = a.porDefecto ?? {};
  const l = a.listas ?? {};
  const usuarios = Array.isArray(a.usuarios)
    ? a.usuarios
        .map((u: { nombre?: unknown; pin?: unknown }) => ({ nombre: texto(u?.nombre).trim(), pin: String(u?.pin ?? '').trim() }))
        .filter((u: { nombre: string; pin: string }) => u.nombre && u.pin)
    : [];
  const rendimientos: Record<string, number> = { ...RENDIMIENTOS_POR_DEFECTO };
  for (const [k, v] of Object.entries(a.rendimientos ?? {})) if (typeof v === 'number' && Number.isFinite(v)) rendimientos[k] = v;

  return {
    empresa: {
      nombre: texto(e.nombre, 'ARCE NUÑEZ'),
      lema: texto(e.lema),
      telefonos: texto(e.telefonos),
      responsable: texto(e.responsable),
      sinpe: texto(e.sinpe),
      correo: texto(e.correo),
      personal: texto(e.personal),
      pie: texto(e.pie),
      logo: texto(e.logo, 'logo.png'),
    },
    usuarios,
    porDefecto: {
      modoPrecio: d.modoPrecio === 'Partes + materiales' ? 'Partes + materiales' : 'Total a mano',
      porcentajeAdelanto: numero(d.porcentajeAdelanto, 0.5),
      iva: numero(d.iva, 0.13),
      validezDias: numero(d.validezDias, 15),
      garantiaMeses: numero(d.garantiaMeses, 3),
      horario: texto(d.horario, 'L-V (7am-5pm)'),
      quienCompraMateriales: d.quienCompraMateriales === 'Arce Nuñez' ? 'Arce Nuñez' : 'El cliente',
      prefijo: texto(d.prefijo, 'COT-') || 'COT-',
    },
    listas: {
      tiposTrabajo: listaTextos(l.tiposTrabajo),
      estados: estados(l.estados),
      unidades: listaTextos(l.unidades, ['unid']),
      categoriasMaterial: listaTextos(l.categoriasMaterial),
      categoriasGasto: listaTextos(l.categoriasGasto),
      categoriasIngreso: listaTextos(l.categoriasIngreso),
      metodosPago: listaTextos(l.metodosPago),
    },
    clausulas: clausulas(a.clausulas),
    rendimientos,
    mezclas: Array.isArray(a.mezclas)
      ? a.mezclas.map((m: Record<string, unknown>) => ({
          tipo: texto(m?.tipo),
          cemento: numero(m?.cemento, 0),
          arena: numero(m?.arena, 0),
          piedra: numero(m?.piedra, 0),
          agua: numero(m?.agua, 0),
        }))
      : [],
  };
}

function firma(x: Record<string, unknown>) {
  return {
    ...(typeof x.modificadoPor === 'string' ? { modificadoPor: x.modificadoPor } : {}),
    ...(typeof x.modificado === 'string' ? { modificado: x.modificado } : {}),
  };
}

export function normalizarMateriales(v: unknown): Material[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((m) => texto(m?.material).trim())
    .map((m) => ({
      material: texto(m.material).trim(),
      unidad: texto(m.unidad, 'unid') || 'unid',
      precio: numeroONulo(m.precio),
      categoria: texto(m.categoria),
      notas: texto(m.notas),
      ...firma(m),
    }));
}

export function normalizarServicios(v: unknown): Servicio[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((s) => texto(s?.servicio).trim())
    .map((s) => ({
      servicio: texto(s.servicio).trim(),
      descripcion: texto(s.descripcion),
      formaCobro: (FORMAS_COBRO as readonly string[]).includes(s.formaCobro) ? s.formaCobro : 'Precio fijo',
      precio: numeroONulo(s.precio),
      tipoTrabajo: texto(s.tipoTrabajo),
      notas: texto(s.notas),
      ...firma(s),
    }));
}

export function normalizarTrabajadores(v: unknown): Trabajador[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((t) => texto(t?.nombre).trim())
    .map((t) => ({
      nombre: texto(t.nombre).trim(),
      puesto: texto(t.puesto),
      valorHora: numeroONulo(t.valorHora),
      telefono: texto(t.telefono),
      ...firma(t),
    }));
}

const fechaValida = (v: unknown): string => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
let contador = 0;
/** Identificador único para cada movimiento u hora. */
export function nuevoId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${(contador++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

export function normalizarMovimientos(v: unknown): Movimiento[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((m) => m && (m.tipo === 'Ingreso' || m.tipo === 'Gasto') && typeof m.monto === 'number')
    .map((m) => ({
      id: texto(m.id) || nuevoId(),
      fecha: fechaValida(m.fecha),
      tipo: m.tipo,
      categoria: texto(m.categoria),
      descripcion: texto(m.descripcion),
      cotizacion: texto(m.cotizacion),
      persona: texto(m.persona),
      metodo: texto(m.metodo),
      monto: Math.abs(numero(m.monto, 0)),
      comprobante: texto(m.comprobante),
      notas: texto(m.notas),
      registradoPor: texto(m.registradoPor),
      registrado: texto(m.registrado),
      ...(texto(m.pagoPlanilla) ? { pagoPlanilla: texto(m.pagoPlanilla) } : {}),
    }));
}

export function normalizarHoras(v: unknown): Hora[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((h) => h && texto(h.trabajador) && typeof h.horas === 'number')
    .map((h) => ({
      id: texto(h.id) || nuevoId(),
      fecha: fechaValida(h.fecha),
      trabajador: texto(h.trabajador),
      cotizacion: texto(h.cotizacion),
      horas: numero(h.horas, 0),
      valorHora: numero(h.valorHora, 0),
      pagado: h.pagado === true,
      fechaPago: fechaValida(h.fechaPago),
      notas: texto(h.notas),
      registradoPor: texto(h.registradoPor),
      registrado: texto(h.registrado),
      ...(texto(h.pagoPlanilla) ? { pagoPlanilla: texto(h.pagoPlanilla) } : {}),
    }));
}
