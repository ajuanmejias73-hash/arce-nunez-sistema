<script lang="ts">
  /**
   * Costos extras de la cotización (transporte, pólizas…). Se cobran al cliente; por defecto
   * van escondidos dentro del total. Cuando la cotización se acepta, se registran solos como
   * gastos estimados de la obra con la categoría escogida.
   */
  import { categoriaSugerida } from '../lib/contabilidad.ts';
  import { datos } from '../lib/datos.svelte.ts';
  import { colones } from '../lib/formato.ts';
  import type { DatosCotizacion } from '../lib/tipos.ts';
  import CampoNumero from './CampoNumero.svelte';

  let { d }: { d: DatosCotizacion } = $props();

  const categorias = $derived(datos.c?.ajustes.listas.categoriasGasto ?? []);
  const SUGERIDOS = ['Transporte de material', 'Póliza de riesgos del trabajo (INS)', 'Acarreo de escombros', 'Alquiler de andamios', 'Alquiler de equipo', 'Viáticos'];
  const total = $derived(d.extras.reduce((s, x) => s + (x.monto ?? 0), 0));

  function nuevo(concepto = '') {
    d.extras.push({ concepto, monto: null, categoria: categoriaSugerida(concepto, categorias), clienteVe: false });
  }

  /** Al escribir el concepto, sugerir la categoría (si no la habían cambiado a mano). */
  function alEscribir(i: number) {
    const x = d.extras[i];
    const sugerida = categoriaSugerida(x.concepto, categorias);
    if (!x.categoria || x.categoria === 'Otros gastos') x.categoria = sugerida || x.categoria;
  }
</script>

<datalist id="lista-extras">{#each SUGERIDOS as s}<option value={s}></option>{/each}</datalist>

<p class="ayuda">
  Se suman al total que paga el cliente. Por defecto <strong>no los ve</strong> (van dentro de la mano de obra). Cuando la cotización pase a
  "Aceptada", se registran solos como gastos estimados de la obra.
</p>

{#if d.extras.length}
  <div class="filas">
    <div class="fila cabeza" aria-hidden="true"><span>Concepto</span><span>Monto (₡)</span><span>Se registra como</span><span>¿Lo ve el cliente?</span><span></span></div>
    {#each d.extras as x, i}
      <div class="fila">
        <input bind:value={x.concepto} list="lista-extras" placeholder="ej. Transporte de material" aria-label="Concepto {i + 1}" oninput={() => alEscribir(i)} />
        <CampoNumero bind:valor={x.monto} dinero etiqueta="Monto del extra {i + 1}" />
        <select bind:value={x.categoria} aria-label="Categoría de gasto {i + 1}">
          <option value="">— escogé —</option>
          {#each categorias as c}<option>{c}</option>{/each}
        </select>
        <label class="ve"><input type="checkbox" bind:checked={x.clienteVe} /> {x.clienteVe ? 'Sí, lo ve' : 'No (escondido)'}</label>
        <button class="quitar" onclick={() => d.extras.splice(i, 1)} aria-label="Quitar extra {i + 1}">×</button>
      </div>
    {/each}
  </div>
  <p class="total">Costos extras: <strong>{colones(total)}</strong></p>
{/if}

<div class="acciones">
  <button class="btn-dorado" onclick={() => nuevo()}>+ Costo extra</button>
  {#each SUGERIDOS.slice(0, 2).filter((s) => !d.extras.some((x) => x.concepto === s)) as s}
    <button class="btn-borde btn-chico" onclick={() => nuevo(s)}>+ {s}</button>
  {/each}
</div>

<style>
  .filas {
    display: grid;
    gap: 6px;
    margin: 10px 0;
    container-type: inline-size;
  }
  .fila {
    display: grid;
    grid-template-columns: 2fr 1fr 1.4fr 1.2fr 34px;
    gap: 6px;
    align-items: center;
  }
  .fila :global(input),
  .fila select {
    margin: 0;
    min-width: 0;
  }
  .cabeza {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--suave);
  }
  .ve {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--texto);
    cursor: pointer;
  }
  .ve input {
    width: 18px;
    min-height: 0;
  }
  .quitar {
    background: transparent;
    border: none;
    color: var(--suave);
    font-size: 1.3rem;
    padding: 0;
    min-height: 38px;
  }
  .quitar:hover {
    color: var(--rojo);
  }
  .total {
    text-align: right;
    margin: 4px 0 10px;
  }
  @container (max-width: 640px) {
    .fila {
      grid-template-columns: 1fr 1fr;
      border: 1px solid var(--linea);
      border-radius: 8px;
      padding: 8px;
    }
    .fila > :first-child {
      grid-column: 1 / 3;
    }
    .cabeza {
      display: none;
    }
  }
</style>
