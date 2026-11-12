<script lang="ts">
  /** Copia escondida (800 px de ancho) de la cotización, de donde salen el PDF y la imagen. */
  import { exportador } from '../lib/exportar.svelte.ts';
  import VistaCotizacion from './VistaCotizacion.svelte';

  let el = $state<HTMLElement>();
  $effect(() => {
    exportador.elemento = el ?? null;
  });
</script>

{#if exportador.modelo}
  <div class="exportador" aria-hidden="true">
    <div bind:this={el}><VistaCotizacion v={exportador.modelo} /></div>
  </div>
{/if}

<style>
  .exportador {
    position: fixed;
    left: 0;
    top: 0;
    width: 800px;
    opacity: 0;
    pointer-events: none;
    z-index: -1;
  }
</style>
