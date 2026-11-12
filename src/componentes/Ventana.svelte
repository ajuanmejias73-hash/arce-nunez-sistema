<script lang="ts">
  /** Ventana encima de la página (para los formularios de contabilidad). */
  import type { Snippet } from 'svelte';

  let { abierta, titulo, cerrar, children }: { abierta: boolean; titulo: string; cerrar: () => void; children: Snippet } = $props();
  let caja = $state<HTMLDialogElement>();

  $effect(() => {
    if (!caja) return;
    if (abierta && !caja.open) caja.showModal();
    if (!abierta && caja.open) caja.close();
  });
</script>

<dialog bind:this={caja} oncancel={(e) => (e.preventDefault(), cerrar())} aria-label={titulo}>
  {#if abierta}
    <div class="cabeza">
      <h2>{titulo}</h2>
      <button class="cerrar" onclick={cerrar} aria-label="Cerrar">×</button>
    </div>
    {@render children()}
  {/if}
</dialog>

<style>
  dialog {
    border: none;
    border-radius: var(--radio);
    padding: 20px 22px 22px;
    width: min(560px, calc(100vw - 24px));
    max-height: calc(100dvh - 24px);
    box-shadow: 0 10px 40px rgb(0 0 0 / 25%);
  }
  dialog::backdrop {
    background: rgb(20 20 20 / 45%);
  }
  .cabeza {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  .cabeza h2 {
    margin: 0;
  }
  .cerrar {
    background: transparent;
    border: none;
    font-size: 1.6rem;
    padding: 0 6px;
    min-height: 36px;
    color: var(--suave);
  }
</style>
