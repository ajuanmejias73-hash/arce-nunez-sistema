<script lang="ts">
  import { datos } from '../lib/datos.svelte.ts';
  import { dialogos } from '../lib/dialogos.svelte.ts';
  import { prepararImagen } from '../lib/imagenes.ts';
  import { sesion } from '../lib/sesion.svelte.ts';
  import type { DatosCotizacion } from '../lib/tipos.ts';
  import Imagen from './Imagen.svelte';

  const MAXIMO = 9;
  let { d }: { d: DatosCotizacion } = $props();
  let subiendo = $state(0);

  async function subir(ev: Event) {
    const input = ev.currentTarget as HTMLInputElement;
    const archivos = [...(input.files ?? [])];
    input.value = '';
    const libres = MAXIMO - d.fotos.length - subiendo;
    if (archivos.length > libres) dialogos.avisar(`Caben ${MAXIMO} fotos. Se suben solo ${Math.max(0, libres)}.`, 'error');
    for (const archivo of archivos.slice(0, Math.max(0, libres))) {
      subiendo++;
      try {
        // Se achica (máx. 1600 px) para que no pese de más; la cotización igual se ve nítida.
        const bytes = await prepararImagen(archivo, 1600, 'image/jpeg');
        const ruta = `fotos/${d.numero}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.jpg`;
        await datos.subirArchivo(ruta, bytes, `subió una foto para ${d.numero}`, sesion.quien);
        d.fotos.push(ruta);
      } catch (e) {
        dialogos.avisar('No se pudo subir la foto: ' + (e instanceof Error ? e.message : String(e)), 'error');
      } finally {
        subiendo--;
      }
    }
  }

  function mover(i: number, paso: number) {
    const j = i + paso;
    if (j < 0 || j >= d.fotos.length) return;
    [d.fotos[i], d.fotos[j]] = [d.fotos[j], d.fotos[i]];
  }
</script>

<div class="fotos">
  {#each d.fotos as f, i (f)}
    <figure>
      <div class="marco"><Imagen ruta={f} alt="Foto {i + 1}" clase="miniatura" /></div>
      <div class="acciones">
        <button class="btn-borde btn-chico" onclick={() => mover(i, -1)} disabled={i === 0} aria-label="Mover foto {i + 1} antes">←</button>
        <button class="btn-borde btn-chico" onclick={() => mover(i, 1)} disabled={i === d.fotos.length - 1} aria-label="Mover foto {i + 1} después">→</button>
        <button class="btn-peligro btn-chico" onclick={() => d.fotos.splice(i, 1)}>Quitar</button>
      </div>
    </figure>
  {/each}
  {#each { length: subiendo } as _}
    <figure><div class="marco cargando">Subiendo…</div></figure>
  {/each}
</div>

{#if d.fotos.length + subiendo < MAXIMO}
  <label class="subir btn-dorado">
    + Fotos ({d.fotos.length} de {MAXIMO})
    <input type="file" accept="image/*" multiple class="oculto-visual" onchange={subir} />
  </label>
{:else}
  <p class="ayuda">Ya hay {MAXIMO} fotos, que es el máximo.</p>
{/if}
<p class="ayuda">Salen en la cotización bajo "Imágenes de referencia", de 3 en 3.</p>

<style>
  .fotos {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
    margin-bottom: 12px;
  }
  figure {
    margin: 0;
    display: grid;
    gap: 6px;
  }
  .marco {
    height: 120px;
    background: var(--fondo);
    border: 1px solid var(--linea);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .marco :global(.miniatura) {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .cargando {
    color: var(--suave);
    font-size: 0.9rem;
  }
  .acciones {
    justify-content: center;
    gap: 4px;
  }
  .subir {
    display: inline-flex;
    align-items: center;
    padding: 9px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    color: var(--carbon-2);
    font-size: 1rem;
  }
  .subir:focus-within {
    outline: 2px solid var(--carbon);
  }
</style>
