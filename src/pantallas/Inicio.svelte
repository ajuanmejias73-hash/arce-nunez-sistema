<script lang="ts">
  import { datos } from '../lib/datos.svelte.ts';
  import { sesion } from '../lib/sesion.svelte.ts';
  import { ETAPA_ACTUAL, GRUPOS, MODULOS, rutas } from '../lib/rutas.svelte.ts';

  /** Los dos botones grandes de arriba; el resto va agrupado abajo. */
  const PRINCIPALES = ['nueva', 'modificar'];
  const pendiente = (ruta: string) => (MODULOS.find((m) => m.ruta === ruta)?.etapa ?? 0) > ETAPA_ACTUAL;
</script>

<h1>Hola, {sesion.usuario}</h1>
<p class="ayuda">
  {datos.c?.cotizaciones.length ?? 0} cotizaciones guardadas · {datos.c?.materiales.length ?? 0} materiales en el catálogo
</p>

<div class="principales">
  <button class="grande btn-dorado" onclick={() => rutas.ir('nueva')}>
    <strong>+ Nueva cotización</strong>
    <span>Para un cliente nuevo o uno que ya tiene cotizaciones</span>
    {#if pendiente('nueva')}<em>Próximamente</em>{/if}
  </button>
  <button class="grande btn" onclick={() => rutas.ir('modificar')}>
    <strong>Modificar cotización</strong>
    <span>Escoger una guardada y hacerle cambios</span>
    {#if pendiente('modificar')}<em>Próximamente</em>{/if}
  </button>
</div>

{#each GRUPOS as g}
  <h2 class="grupo">{g}</h2>
  <div class="cuadricula">
    {#each MODULOS.filter((m) => m.grupo === g && !PRINCIPALES.includes(m.ruta)) as m}
      <button class="tarjeta modulo" onclick={() => rutas.ir(m.ruta)}>
        <strong>{m.nombre}</strong>
        <span>{m.descripcion}</span>
        {#if m.etapa > ETAPA_ACTUAL}<em>Próximamente</em>{/if}
      </button>
    {/each}
  </div>
{/each}

<style>
  .principales {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 14px;
    margin-top: 18px;
  }
  .grande {
    display: grid;
    gap: 6px;
    text-align: left;
    padding: 20px;
    border-radius: var(--radio);
    box-shadow: var(--sombra);
    font-weight: 400;
  }
  .grande strong {
    font-size: 1.25rem;
  }
  .grande span {
    opacity: 0.85;
    font-size: 0.92rem;
  }
  .grande em {
    font-style: normal;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    opacity: 0.75;
  }
  .grupo {
    margin: 26px 0 10px;
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--suave);
  }
  .cuadricula {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 14px;
  }
  .modulo {
    text-align: left;
    display: grid;
    gap: 6px;
    align-content: start;
    font-weight: 400;
    color: var(--texto);
    margin: 0;
  }
  .modulo:hover {
    border-color: var(--dorado);
  }
  .modulo strong {
    font-size: 1.05rem;
  }
  .modulo span {
    color: var(--suave);
    font-size: 0.9rem;
  }
  .modulo em {
    font-style: normal;
    font-size: 0.78rem;
    color: var(--dorado-osc);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
