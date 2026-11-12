<script lang="ts">
  /** Muestra la cotización (800 px) achicada para que quepa en la pantalla. */
  import type { ModeloVista } from '../lib/modelo.ts';
  import VistaCotizacion from './VistaCotizacion.svelte';

  let { v }: { v: ModeloVista } = $props();
  let ancho = $state(800);
  const escala = $derived(Math.min(1, ancho / 800));
</script>

<div class="marco" bind:clientWidth={ancho}>
  <div class="hoja-pantalla" style:zoom={escala}>
    <VistaCotizacion {v} />
  </div>
</div>

<style>
  .marco {
    width: 100%;
    min-width: 0;
    overflow: hidden;
    display: flex;
    justify-content: center;
  }
  .hoja-pantalla {
    box-shadow: 0 6px 30px rgb(0 0 0 / 15%);
    border-radius: 4px;
    overflow: hidden;
  }
</style>
