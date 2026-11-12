<script lang="ts">
  /**
   * "Agregar a la cotización": pregunta en cuál Parte y si el cliente lo ve,
   * lo agrega a la cotización abierta y muestra un resumen.
   */
  import { agregarACotizacion, nombreParte } from '../lib/agregar.ts';
  import type { Resultado } from '../lib/calculadoras.ts';
  import { datosNuevos, siguienteNumero } from '../lib/cotizacion.ts';
  import { datos } from '../lib/datos.svelte.ts';
  import { dialogos } from '../lib/dialogos.svelte.ts';
  import { editor } from '../lib/editor.svelte.ts';
  import { colones } from '../lib/formato.ts';
  import { rutas } from '../lib/rutas.svelte.ts';

  let { resultado = $bindable() }: { resultado: Resultado | null } = $props();

  let caja = $state<HTMLDialogElement>();
  let parte = $state<string>('nueva');
  let nombreNueva = $state('');
  let ve = $state<'si' | 'no'>('si');
  let monto = $state<'sumar' | 'reemplazar'>('sumar');

  const d = $derived(editor.d);
  const parteElegida = $derived(d && parte !== 'nueva' ? d.partes[Number(parte)] : null);
  const preguntarMonto = $derived(resultado?.monto !== undefined && parteElegida?.monto !== null && parteElegida?.monto !== undefined);
  const aAgregar = $derived(resultado ? resultado.materiales.filter((m) => m.agregar && m.cantidad > 0).length : 0);

  $effect(() => {
    if (!caja) return;
    if (resultado && !caja.open) {
      // Por defecto, la última Parte con nombre (o crear una nueva si no hay).
      let ultima = -1;
      d?.partes.forEach((p, i) => p.nombre.trim() && (ultima = i));
      parte = ultima >= 0 ? String(ultima) : d?.partes.length ? '0' : 'nueva';
      nombreNueva = '';
      ve = 'si';
      monto = 'sumar';
      caja.showModal();
    }
    if (!resultado && caja.open) caja.close();
  });

  function crearCotizacion() {
    if (!datos.c) return;
    editor.abrir(datosNuevos(datos.c.ajustes, siguienteNumero(datos.c.cotizaciones, datos.c.ajustes.porDefecto.prefijo)), null);
    parte = '0';
  }

  async function agregar(ev: SubmitEvent) {
    ev.preventDefault();
    if (!resultado || !editor.d || !datos.c) return;
    if (parte === 'nueva' && !nombreNueva.trim()) return dialogos.avisar('Escribí el nombre de la Parte nueva.', 'error');
    const r = agregarACotizacion(
      editor.d,
      $state.snapshot(resultado) as Resultado,
      { parte: parte === 'nueva' ? { nueva: nombreNueva } : Number(parte), clienteVe: ve === 'si', monto },
      datos.c.materiales,
    );
    resultado = null;
    const lineas = [
      `En ${r.parte}: «${r.renglon}»${ve === 'no' ? ' (oculto para el cliente)' : ''}`,
      r.nuevos.length ? `Materiales nuevos: ${r.nuevos.join(', ')}` : '',
      r.sumados.length ? `Se sumó la cantidad a: ${r.sumados.join(', ')}` : '',
      r.monto !== null ? `Monto de la Parte: ${colones(r.monto)} (la cotización quedó en modo "Partes + materiales")` : '',
    ].filter(Boolean);
    const ir = await dialogos.confirmar(`Agregado a ${editor.d.numero}`, lineas.join('\n'), { si: 'Ir a la cotización', no: 'Seguir calculando' });
    if (ir) rutas.ir('cotizacion');
  }
</script>

<dialog bind:this={caja} oncancel={() => (resultado = null)} aria-labelledby="agregar-titulo">
  {#if resultado}
    <form onsubmit={agregar}>
      <h2 id="agregar-titulo">Agregar a la cotización</h2>
      <p class="renglon">«{resultado.renglon}»</p>
      <p class="ayuda">
        {aAgregar ? `${aAgregar} ${aAgregar === 1 ? 'material' : 'materiales'}` : 'Sin materiales'}{resultado.monto !== undefined ? ` · monto ${colones(resultado.monto)}` : ''}
      </p>

      {#if !d}
        <p>No hay ninguna cotización abierta.</p>
        <div class="acciones">
          <button type="button" class="btn-dorado" onclick={crearCotizacion}>Crear una cotización nueva</button>
          <button type="button" class="btn-borde" onclick={() => (resultado = null)}>Cancelar</button>
        </div>
        <p class="ayuda">O abrí una con "Modificar cotización" y volvé a la Calculadora.</p>
      {:else}
        <p class="destino">Se agrega a <strong>{d.numero}{d.cliente.trim() ? ' · ' + d.cliente.trim() : ''}</strong></p>
        <label>
          ¿En cuál Parte?
          <select bind:value={parte}>
            {#each d.partes as _, i}<option value={String(i)}>{nombreParte(d, i)}</option>{/each}
            <option value="nueva">＋ Crear Parte nueva</option>
          </select>
        </label>
        {#if parte === 'nueva'}
          <!-- svelte-ignore a11y_autofocus -->
          <label class="sep">Nombre de la Parte nueva <input bind:value={nombreNueva} autofocus placeholder="ej. Pintura de paredes" /></label>
        {/if}

        <fieldset>
          <legend>¿Que el cliente vea esto?</legend>
          <label class="opcion"><input type="radio" bind:group={ve} value="si" /> Sí</label>
          <label class="opcion"><input type="radio" bind:group={ve} value="no" /> No (cuenta en el total, pero no sale)</label>
        </fieldset>

        {#if preguntarMonto && parteElegida}
          <fieldset>
            <legend>Esa Parte ya tiene {colones(parteElegida.monto)}</legend>
            <label class="opcion"><input type="radio" bind:group={monto} value="sumar" /> Sumarle {colones(resultado.monto)} (queda en {colones((parteElegida.monto ?? 0) + (resultado.monto ?? 0))})</label>
            <label class="opcion"><input type="radio" bind:group={monto} value="reemplazar" /> Reemplazarlo por {colones(resultado.monto)}</label>
          </fieldset>
        {/if}

        <div class="acciones">
          <button type="submit" class="btn">Agregar</button>
          <button type="button" class="btn-borde" onclick={() => (resultado = null)}>Cancelar</button>
        </div>
      {/if}
    </form>
  {/if}
</dialog>

<style>
  dialog {
    border: none;
    border-radius: var(--radio);
    padding: 22px;
    width: min(480px, calc(100vw - 32px));
    box-shadow: 0 10px 40px rgb(0 0 0 / 25%);
  }
  dialog::backdrop {
    background: rgb(20 20 20 / 45%);
  }
  .renglon {
    font-style: italic;
    margin: 0 0 4px;
  }
  .destino {
    margin: 12px 0;
  }
  .sep {
    margin-top: 10px;
  }
  fieldset {
    border: 1px solid var(--linea);
    border-radius: 8px;
    margin: 14px 0 0;
    padding: 8px 12px 10px;
  }
  legend {
    font-weight: 600;
    font-size: 0.9rem;
    padding: 0 4px;
  }
  .opcion {
    display: flex;
    gap: 8px;
    align-items: center;
    color: var(--texto);
    font-weight: 400;
    font-size: 0.95rem;
    padding: 4px 0;
    cursor: pointer;
  }
  .opcion input {
    width: 18px;
    min-height: 0;
    margin: 0;
    accent-color: var(--dorado-osc);
  }
  .acciones {
    margin-top: 18px;
  }
</style>
