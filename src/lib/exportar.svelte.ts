/**
 * Convierte la vista del cliente en PDF (tamaño carta A4, sin cortar renglones a la mitad). Se dibuja una copia escondida de 800 px de ancho para que
 * salga igual desde la compu o desde el celular.
 */
import { tick } from 'svelte';
import type { ModeloVista } from './modelo.ts';
import { dialogos } from './dialogos.svelte.ts';

const ANCHO = 800;
/** Alto de una hoja A4 cuando el ancho mide 800 px. */
const ALTO_HOJA = (ANCHO * 297) / 210;
/** Margen arriba y abajo en las hojas 2, 3… */
const MARGEN = 28;

class Exportador {
  /** Lo que se está dibujando en la copia escondida. */
  modelo = $state<ModeloVista | null>(null);
  elemento: HTMLElement | null = null;
  private cola: Promise<unknown> = Promise.resolve();

  /** Dibuja la vista escondida y devuelve el lienzo (de a uno por vez). */
  private dibujar<T>(modelo: ModeloVista, usar: (lienzo: HTMLCanvasElement, cortes: number[], alto: number) => Promise<T>): Promise<T> {
    const tarea = this.cola.then(async () => {
      this.modelo = modelo;
      try {
        await tick();
        const el = this.elemento;
        if (!el) throw new Error('No se pudo preparar la cotización.');
        await esperarImagenes(el);
        const alto = el.offsetHeight;
        const arriba = el.getBoundingClientRect().top;
        // Posibles puntos de corte entre hojas: el final de cada bloque (menos los títulos).
        const cortes = [...el.querySelectorAll<HTMLElement>('[data-bloque]')]
          .filter((b) => b.dataset.bloque !== 'titulo')
          .map((b) => Math.round(b.getBoundingClientRect().bottom - arriba));
        const { default: html2canvas } = await import('html2canvas');
        // Navegadores de celular limitan el tamaño del lienzo: bajar la escala en cotizaciones muy largas.
        const escala = Math.min(2, Math.sqrt(16_000_000 / (ANCHO * Math.max(alto, 1))));
        const lienzo = await html2canvas(el, {
          scale: escala,
          backgroundColor: '#ffffff',
          logging: false,
          width: ANCHO,
          windowWidth: ANCHO,
          onclone: (doc) => {
            const copia = doc.querySelector<HTMLElement>('.exportador');
            if (copia) copia.style.opacity = '1';
          },
        });
        return await usar(lienzo, cortes, alto);
      } finally {
        this.modelo = null;
      }
    });
    this.cola = tarea.catch(() => {});
    return tarea;
  }


  pdf(modelo: ModeloVista): Promise<Blob> {
    return this.dibujar(modelo, async (lienzo, cortes, alto) => {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
      const anchoPt = doc.internal.pageSize.getWidth();
      const k = anchoPt / ANCHO;
      const escala = lienzo.width / ANCHO;
      const tramos = repartirEnHojas(alto, cortes);
      tramos.forEach(([desde, hasta], i) => {
        if (i > 0) doc.addPage();
        const trozo = document.createElement('canvas');
        trozo.width = lienzo.width;
        trozo.height = Math.max(1, Math.round((hasta - desde) * escala));
        const ctx = trozo.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, trozo.width, trozo.height);
        ctx.drawImage(lienzo, 0, Math.round(desde * escala), lienzo.width, trozo.height, 0, 0, trozo.width, trozo.height);
        const y = i === 0 ? 0 : MARGEN;
        doc.addImage(trozo.toDataURL('image/jpeg', 0.9), 'JPEG', 0, y * k, anchoPt, (hasta - desde) * k);
      });
      return doc.output('blob');
    });
  }
}

/** Reparte la cotización en hojas, cortando solo entre bloques. Devuelve [desde, hasta] por hoja. */
export function repartirEnHojas(alto: number, cortes: number[]): [number, number][] {
  const puntos = [...new Set(cortes)].filter((c) => c > 0 && c < alto).sort((a, b) => a - b);
  const hojas: [number, number][] = [];
  let desde = 0;
  while (desde < alto - 1) {
    const cabe = hojas.length === 0 ? ALTO_HOJA : ALTO_HOJA - 2 * MARGEN;
    let hasta = desde + cabe;
    if (hasta >= alto) hasta = alto;
    else {
      const mejor = puntos.filter((p) => p > desde + 40 && p <= hasta).pop();
      if (mejor) hasta = mejor;
    }
    hojas.push([desde, hasta]);
    desde = hasta;
  }
  return hojas;
}

async function esperarImagenes(el: HTMLElement): Promise<void> {
  const limite = Date.now() + 10_000;
  while (Date.now() < limite) {
    const cargando = el.querySelectorAll('.sin-imagen:empty').length;
    const imgs = [...el.querySelectorAll('img')];
    if (!cargando && imgs.every((i) => i.complete)) {
      await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}


export const exportador = new Exportador();

export function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Abre el menú "Compartir" del celular (para mandarlo por WhatsApp).
 * En la compu, o si el navegador no puede, lo descarga.
 */
export async function compartir(blob: Blob, nombre: string): Promise<void> {
  const archivo = new File([blob], nombre, { type: blob.type });
  if (!navigator.canShare?.({ files: [archivo] })) {
    descargar(blob, nombre);
    dialogos.avisar('Se descargó el archivo. Adjuntalo en WhatsApp.');
    return;
  }
  try {
    await navigator.share({ files: [archivo], title: nombre });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return; // la persona cerró el menú
    if (e instanceof DOMException && e.name === 'NotAllowedError') {
      // Tardó mucho en prepararse y el navegador pide tocar otra vez.
      if (await dialogos.confirmar('El archivo está listo', nombre, { si: 'Compartir' })) {
        await navigator.share({ files: [archivo], title: nombre }).catch(() => {});
      }
      return;
    }
    throw e;
  }
}
