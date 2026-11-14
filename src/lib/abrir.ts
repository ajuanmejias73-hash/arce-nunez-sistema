/** Acciones sobre cotizaciones guardadas: abrir en el editor, usar de base, estado, notas, PDF. */
import { datos } from './datos.svelte.ts';
import { dialogos } from './dialogos.svelte.ts';
import { editor } from './editor.svelte.ts';
import { rutas } from './rutas.svelte.ts';
import { sesion } from './sesion.svelte.ts';
import { exportador } from './exportar.svelte.ts';
import { ESTADOS_ACEPTADOS, siguienteNumero, ultimaVersion } from './cotizacion.ts';
import { registrarGastosAlAceptar } from './acciones-contables.ts';
import { hoyISO } from './formato.ts';
import { armarVista, nombreArchivo, type ModeloVista } from './modelo.ts';
import type { Cotizacion, DatosCotizacion, Version } from './tipos.ts';

/** Devuelve true si se puede reemplazar lo que está abierto en el editor. */
export async function puedeReemplazar(): Promise<boolean> {
  if (!editor.d || !editor.sinGuardar) return true;
  const d = editor.d;
  return dialogos.confirmar(
    'Hay una cotización sin guardar',
    `${d.numero}${d.cliente.trim() ? ' · ' + d.cliente.trim() : ''} tiene cambios que no se han guardado. Si seguís, se pierden.`,
    { si: 'Descartar cambios y seguir', no: 'Volver', peligro: true },
  );
}

export function abrirEnEditor(d: DatosCotizacion, base: { numero: string; version: number } | null): void {
  if (!datos.c) return;
  editor.abrir(d, base);
  rutas.ir('cotizacion');
}

/** Modificar: al guardar queda como la versión siguiente. */
export async function modificar(c: Cotizacion, v: Version = ultimaVersion(c)): Promise<void> {
  // Si ya está abierta con cambios, seguir con esos cambios.
  if (editor.d && editor.sinGuardar && editor.base?.numero === c.numero && editor.base.version === v.version) return rutas.ir('cotizacion');
  if (v.version !== c.versionActual) {
    const ok = await dialogos.confirmar(
      `La v${v.version} no es la última`,
      `La última es la v${c.versionActual}. Si modificás la v${v.version} y la guardás, queda como v${c.versionActual + 1} con lo que tenía la v${v.version}.`,
      { si: `Modificar la v${v.version}` },
    );
    if (!ok) return;
  }
  if (!(await puedeReemplazar())) return;
  abrirEnEditor(v.datos, { numero: c.numero, version: v.version });
}

/** Usar de base: una cotización NUEVA (número y fecha nuevos) con los mismos datos. */
export async function usarDeBase(c: Cotizacion, v: Version = ultimaVersion(c)): Promise<void> {
  if (!datos.c || !(await puedeReemplazar())) return;
  const numero = siguienteNumero(datos.c.cotizaciones, datos.c.ajustes.porDefecto.prefijo);
  // (el editor hace su propia copia de los datos)
  abrirEnEditor({ ...v.datos, numero, fecha: hoyISO() }, null);
  dialogos.avisar(`Nueva cotización ${numero} a partir de ${c.numero}`);
}

export async function cambiarEstado(numero: string, estado: string): Promise<void> {
  try {
    await datos.modificar(
      'cotizaciones',
      (l) => {
        const c = l.find((x) => x.numero === numero);
        if (!c) throw new Error(`no se encontró ${numero}.`);
        c.estado = estado;
        c.estadoPor = sesion.quien;
        c.estadoFecha = new Date().toISOString();
      },
      `cambió ${numero} a «${estado}»`,
      sesion.quien,
    );
    const estimados = ESTADOS_ACEPTADOS.includes(estado) ? await registrarGastosAlAceptar(numero) : 0;
    dialogos.avisar(estimados ? `${numero}: ${estado}. Se registraron ${estimados} gastos estimados de la obra (revisalos en Pagos y gastos).` : `${numero}: ${estado}`);
  } catch (e) {
    dialogos.fallo(e);
  }
}

export async function guardarNotasInternas(numero: string, notas: string): Promise<boolean> {
  try {
    await datos.modificar(
      'cotizaciones',
      (l) => {
        const c = l.find((x) => x.numero === numero);
        if (!c) throw new Error(`no se encontró ${numero}.`);
        if (notas.trim()) c.notasInternas = notas.trim();
        else delete c.notasInternas;
      },
      `cambió las notas de ${numero}`,
      sesion.quien,
    );
    dialogos.avisar('Notas guardadas');
    return true;
  } catch (e) {
    dialogos.fallo(e);
    return false;
  }
}

/**
 * Lo que ve el cliente en una versión: su "foto fija" si la tiene; las importadas del
 * Excel no la tienen y se arman con los Ajustes y el Catálogo de hoy.
 */
export function vistaDe(v: Version): ModeloVista {
  if (v.vista && typeof v.vista === 'object') return v.vista as ModeloVista;
  return armarVista(v.datos, datos.c!.ajustes, datos.c!.materiales).vista;
}

export function nombreDe(c: Cotizacion, v: Version): string {
  const base = nombreArchivo(c.numero, v.datos.cliente.trim() || c.cliente);
  return v.version === c.versionActual ? base : `${base} v${v.version}`;
}

/** El PDF guardado de esa versión; si no hay (o se perdió), se crea de nuevo igualito. */
export async function pdfDe(v: Version): Promise<Blob> {
  if (v.pdf && datos.repo) {
    const a = await datos.repo.leer(v.pdf).catch(() => null);
    if (a) return new Blob([a.bytes as BlobPart], { type: 'application/pdf' });
  }
  return exportador.pdf(vistaDe(v));
}
