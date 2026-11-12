/**
 * La cotización que se está escribiendo. Se guarda sola en este dispositivo (borrador)
 * para no perder lo escrito, y al tocar "Guardar" queda como versión v1, v2, v3…
 */
import { datos } from './datos.svelte.ts';
import { armarVista, type ModeloVista } from './modelo.ts';
import { normalizarDatos, siguienteNumero, ultimaVersion } from './cotizacion.ts';
import { escribirLocal, leerLocal, borrarLocal } from './guardado.ts';
import type { Cotizacion, DatosCotizacion, Version } from './tipos.ts';

const CLAVE = 'arce.borrador';

interface Borrador {
  d: DatosCotizacion;
  base: { numero: string; version: number } | null;
  limpio: string;
}

class Editor {
  d = $state<DatosCotizacion | null>(null);
  /** Cotización guardada de la que salió (null = cotización nueva todavía sin guardar). */
  base = $state<{ numero: string; version: number } | null>(null);
  /** Cómo estaban los datos la última vez que se guardaron o abrieron. */
  private limpio = $state('');

  constructor() {
    const b = leerLocal<Borrador>(CLAVE);
    if (b?.d) {
      this.d = normalizarDatos(b.d);
      this.base = b.base ?? null;
      this.limpio = b.limpio ?? '';
    }
    let reloj: ReturnType<typeof setTimeout> | undefined;
    $effect.root(() => {
      $effect(() => {
        const texto = JSON.stringify({ d: this.d, base: this.base, limpio: this.limpio });
        clearTimeout(reloj);
        reloj = setTimeout(() => (this.d ? escribirLocal(CLAVE, JSON.parse(texto)) : borrarLocal(CLAVE)), 300);
      });
    });
  }

  /** Hay cambios que no se han guardado en el historial. */
  get sinGuardar(): boolean {
    return !!this.d && JSON.stringify(this.d) !== this.limpio;
  }

  abrir(d: DatosCotizacion, base: Editor['base']): void {
    this.d = normalizarDatos($state.snapshot(d));
    // Una cotización nueva empieza con una Parte vacía, lista para escribir.
    if (!base && !this.d.partes.length) this.d.partes.push({ nombre: '', monto: null, renglones: [{ texto: '', clienteVe: true }] });
    this.base = base;
    this.limpio = JSON.stringify(this.d);
  }

  cerrar(): void {
    this.d = null;
    this.base = null;
    this.limpio = '';
  }

  /** La cotización guardada de la que salió este borrador. */
  get guardada(): Cotizacion | undefined {
    return this.base ? datos.c?.cotizaciones.find((c) => c.numero === this.base!.numero) : undefined;
  }

  /** "nueva (v1)", "v2 (guardada)" o "modificando v1 → se guardará como v2". */
  get etiquetaVersion(): string {
    if (!this.d) return '';
    const g = this.guardada;
    if (!this.base || !g) return 'nueva (v1)';
    const siguiente = ultimaVersion(g).version + 1;
    if (this.sinGuardar) return `modificando v${this.base.version} → se guardará como v${siguiente}`;
    if (this.base.version < g.versionActual) return `v${this.base.version} (no es la última: la última es v${g.versionActual})`;
    return `v${this.base.version} (guardada)`;
  }

  vista(): { vista: ModeloVista; calculo: ReturnType<typeof armarVista>['calculo'] } | null {
    if (!this.d || !datos.c) return null;
    return armarVista(this.d, datos.c.ajustes, datos.c.materiales);
  }

  /**
   * Guarda en el historial. Si el número ya existe, queda como la versión siguiente;
   * si no, como v1 "Original". Devuelve la versión guardada.
   */
  async guardar(queCambio: string, quien: string): Promise<{ numero: string; version: Version }> {
    if (!this.d || !datos.c) throw new Error('No hay cotización abierta.');
    const d = normalizarDatos($state.snapshot(this.d));
    if (!d.cliente.trim()) throw new Error('Falta el nombre del cliente.');
    const esModificacion = this.base !== null;
    const ajustes = datos.c.ajustes;
    const catalogo = datos.c.materiales;
    let guardada: Version | null = null;

    await datos.modificar(
      'cotizaciones',
      (lista) => {
        let c = lista.find((x) => x.numero === d.numero);
        // Una cotización NUEVA nunca se mezcla con otra: si el número ya lo usó alguien, toma el siguiente.
        if (c && !esModificacion) {
          d.numero = siguienteNumero(lista, ajustes.porDefecto.prefijo);
          c = undefined;
        }
        const n = c ? ultimaVersion(c).version + 1 : 1;
        const { vista, calculo } = armarVista(d, ajustes, catalogo);
        guardada = {
          version: n,
          guardado: new Date().toISOString(),
          guardadoPor: quien,
          queCambio: n === 1 ? 'Original' : queCambio,
          total: calculo.total,
          adelanto: calculo.adelanto,
          datos: structuredClone(d),
          vista,
          pdf: `pdf/${d.numero} ${d.cliente.trim().replace(/[\\/:*?"<>|]+/g, ' ')} v${n}.pdf`,
        };
        if (c) {
          c.versiones.push(guardada);
          c.versionActual = n;
          c.cliente = d.cliente.trim();
        } else {
          lista.push({
            numero: d.numero,
            cliente: d.cliente.trim(),
            estado: ajustes.listas.estados[0]?.nombre ?? 'Pendiente',
            versionActual: 1,
            versiones: [guardada],
          });
        }
      },
      esModificacion ? `guardó ${d.numero} (${d.cliente.trim()})${queCambio ? ': ' + queCambio : ''}` : `creó ${d.numero} (${d.cliente.trim()})`,
      quien,
    );

    const v = guardada as unknown as Version;
    // El número pudo cambiar si alguien guardó otra cotización nueva al mismo tiempo.
    if (this.d) this.d.numero = d.numero;
    this.base = { numero: d.numero, version: v.version };
    this.limpio = JSON.stringify(this.d);
    return { numero: d.numero, version: v };
  }
}

export const editor = new Editor();
