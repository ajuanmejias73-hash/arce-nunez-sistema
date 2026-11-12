<script lang="ts">
  import { datos } from '../lib/datos.svelte.ts';

  let { ruta, alt = '', clase = '', version = 0 }: { ruta: string; alt?: string; clase?: string; version?: number } = $props();

  let url = $state<string | null>(null);
  let fallo = $state(false);

  $effect(() => {
    void version;
    url = null;
    fallo = false;
    if (!ruta) return;
    let vigente = true;
    datos
      .imagen(ruta)
      .then((u) => vigente && (url = u))
      .catch(() => vigente && (fallo = true));
    return () => {
      vigente = false;
    };
  });
</script>

{#if url}
  <img src={url} {alt} class={clase} />
{:else if fallo}
  <span class="sin-imagen {clase}" role="img" aria-label={alt}>Sin imagen</span>
{:else}
  <span class="sin-imagen {clase}" aria-hidden="true"></span>
{/if}

<style>
  .sin-imagen {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    color: var(--suave);
    background: #ece7dd;
  }
</style>
