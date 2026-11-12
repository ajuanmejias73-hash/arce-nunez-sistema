/**
 * Todos los datos del sistema, compartidos por todas las pantallas.
 * Se leen del repositorio privado al entrar y cada cambio se guarda de inmediato
 * (con reintento si el otro usuario guardó al mismo tiempo).
 */
import { RepoDatos, type Conexion } from './github.ts';
import { normalizarAjustes, normalizarHoras, normalizarMateriales, normalizarMovimientos, normalizarServicios, normalizarTrabajadores } from './normalizar.ts';
import { guardarConReintento } from './reintento.ts';
import type { Ajustes, Cotizacion, Hora, Material, Movimiento, Servicio, Trabajador } from './tipos.ts';
import { normalizarCotizaciones } from './cotizacion.ts';

/** Cada archivo del repositorio de datos, con cómo se ordena al leerlo. */
const ARCHIVOS = {
  ajustes: { ruta: 'ajustes.json', normalizar: normalizarAjustes },
  materiales: { ruta: 'catalogo_materiales.json', normalizar: normalizarMateriales },
  servicios: { ruta: 'catalogo_servicios.json', normalizar: normalizarServicios },
  cotizaciones: { ruta: 'cotizaciones.json', normalizar: normalizarCotizaciones },
  movimientos: { ruta: 'movimientos.json', normalizar: normalizarMovimientos },
  trabajadores: { ruta: 'trabajadores.json', normalizar: normalizarTrabajadores },
  horas: { ruta: 'horas.json', normalizar: normalizarHoras },
} as const;

export interface Contenido {
  ajustes: Ajustes;
  materiales: Material[];
  servicios: Servicio[];
  cotizaciones: Cotizacion[];
  movimientos: Movimiento[];
  trabajadores: Trabajador[];
  horas: Hora[];
}

export type Clave = keyof Contenido;

class Datos {
  estado = $state<'desconectado' | 'cargando' | 'listo' | 'error'>('desconectado');
  error = $state('');
  /** Hay un guardado en curso (para mostrar "Guardando…"). */
  guardando = $state(0);
  c = $state<Contenido | null>(null);

  repo: RepoDatos | null = null;
  private shas: Partial<Record<Clave, string | null>> = {};
  /** Huella del último cambio del repositorio que ya está cargado en pantalla. */
  private ultimoVisto: string | null = null;
  /** Cuenta los guardados de este dispositivo (para no pisarlos con una lectura vieja). */
  private escrituras = 0;
  private revisando = false;
  private imagenes = new Map<string, Promise<string>>();

  async conectar(conexion: Conexion): Promise<void> {
    this.repo = new RepoDatos(conexion);
    this.estado = 'cargando';
    this.error = '';
    try {
      await this.recargar();
      this.estado = 'listo';
    } catch (e) {
      this.estado = 'error';
      this.error = e instanceof Error ? e.message : String(e);
    }
  }

  desconectar(): void {
    this.repo = null;
    this.c = null;
    this.shas = {};
    this.ultimoVisto = null;
    for (const p of this.imagenes.values()) p.then((u) => URL.revokeObjectURL(u)).catch(() => {});
    this.imagenes.clear();
    this.estado = 'desconectado';
  }

  /**
   * Revisa si alguien guardó algo desde la última vez y, si es así, trae todo de nuevo.
   * Devuelve el mensaje del cambio (ej. "Lin: agregó el material «X»") o null si no hubo cambios.
   */
  async revisarCambios(): Promise<string | null> {
    if (!this.repo || !this.c || this.revisando || this.guardando > 0) return null;
    this.revisando = true;
    try {
      const ultimo = await this.repo.ultimoCambio();
      if (!ultimo || ultimo.sha === this.ultimoVisto) return null;
      const cargado = await this.recargar(ultimo.sha);
      return cargado ? ultimo.mensaje : null;
    } catch {
      return null; // sin internet un momento: se vuelve a intentar en la próxima revisión
    } finally {
      this.revisando = false;
    }
  }

  /**
   * Lee de nuevo todos los archivos. `cambio` = huella del último cambio que se está leyendo.
   * Devuelve false si mientras tanto este dispositivo guardó algo (se descarta la lectura vieja).
   */
  async recargar(cambio?: string): Promise<boolean> {
    const repo = this.repo!;
    const ultimo = cambio ?? (await repo.ultimoCambio().catch(() => null))?.sha ?? null;
    const escriturasAntes = this.escrituras;
    const claves = Object.keys(ARCHIVOS) as Clave[];
    const leidos = await Promise.all(claves.map((k) => repo.leerJson<unknown>(ARCHIVOS[k].ruta)));
    if (!leidos[0]) {
      throw new Error('El repositorio de datos no tiene el archivo ajustes.json. Hay que cargarle los datos iniciales.');
    }
    if (this.escrituras !== escriturasAntes || this.guardando > 0) return false;
    this.ultimoVisto = ultimo;
    const nuevo: Record<string, unknown> = {};
    claves.forEach((k, i) => {
      nuevo[k] = ARCHIVOS[k].normalizar(leidos[i]?.datos ?? null);
      this.shas[k] = leidos[i]?.sha ?? null;
    });
    this.c = nuevo as unknown as Contenido;
    return true;
  }

  /**
   * Cambia un archivo y lo guarda. `cambio` recibe una copia de lo último guardado.
   * `mensaje` queda en el historial del repositorio con el nombre de quien lo hizo.
   */
  async modificar<K extends Clave>(clave: K, cambio: (copia: Contenido[K]) => Contenido[K] | void, mensaje: string, quien: string): Promise<void> {
    if (!this.repo || !this.c) throw new Error('No hay conexión con los datos.');
    const def = ARCHIVOS[clave];
    this.guardando++;
    try {
      const res = await guardarConReintento<Contenido[K]>(
        this.repo,
        def.ruta,
        { datos: $state.snapshot(this.c[clave]) as Contenido[K], sha: this.shas[clave] ?? null },
        cambio,
        `${quien}: ${mensaje}`,
        def.normalizar as (x: unknown) => Contenido[K],
      );
      this.c[clave] = res.datos;
      this.shas[clave] = res.sha;
    } finally {
      this.escrituras++;
      this.guardando--;
    }
  }

  /** Dirección para mostrar una imagen guardada en el repositorio privado. */
  imagen(ruta: string): Promise<string> {
    let p = this.imagenes.get(ruta);
    if (!p) {
      p = (async () => {
        const a = await this.repo?.leer(ruta);
        if (!a) throw new Error('No se encontró la imagen ' + ruta);
        const tipo = /\.jpe?g$/i.test(ruta) ? 'image/jpeg' : /\.webp$/i.test(ruta) ? 'image/webp' : 'image/png';
        return URL.createObjectURL(new Blob([a.bytes as BlobPart], { type: tipo }));
      })();
      p.catch(() => this.imagenes.delete(ruta));
      this.imagenes.set(ruta, p);
    }
    return p;
  }

  /** Guarda (o reemplaza) un archivo de imagen en el repositorio. */
  async subirArchivo(ruta: string, bytes: Uint8Array, mensaje: string, quien: string): Promise<void> {
    const repo = this.repo!;
    this.guardando++;
    try {
      const actual = await repo.leer(ruta);
      await repo.escribir(ruta, bytes, actual?.sha ?? null, `${quien}: ${mensaje}`);
      const vieja = this.imagenes.get(ruta);
      this.imagenes.delete(ruta);
      vieja?.then((u) => URL.revokeObjectURL(u)).catch(() => {});
    } finally {
      this.escrituras++;
      this.guardando--;
    }
  }
}

export const datos = new Datos();
