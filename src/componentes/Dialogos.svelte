<script lang="ts">
  import { dialogos } from '../lib/dialogos.svelte.ts';

  let caja = $state<HTMLDialogElement>();

  $effect(() => {
    if (!caja) return;
    if (dialogos.pregunta && !caja.open) caja.showModal();
    if (!dialogos.pregunta && caja.open) caja.close();
  });

  function enviar(ev: SubmitEvent) {
    ev.preventDefault();
    dialogos.pregunta?.responder(true);
  }
</script>

<dialog bind:this={caja} oncancel={() => dialogos.pregunta?.responder(false)} aria-labelledby="pregunta-titulo">
  {#if dialogos.pregunta}
    <form onsubmit={enviar}>
      <h2 id="pregunta-titulo">{dialogos.pregunta.titulo}</h2>
      {#if dialogos.pregunta.texto}<p>{dialogos.pregunta.texto}</p>{/if}
      {#if dialogos.pregunta.campo}
        <label class="campo">
          {dialogos.pregunta.campo.etiqueta}
          <!-- svelte-ignore a11y_autofocus -->
          <input bind:value={dialogos.pregunta.campo.valor} autofocus />
        </label>
      {/if}
      <div class="acciones">
        <button type="submit" class={dialogos.pregunta.peligro ? 'btn-peligro' : 'btn'}>{dialogos.pregunta.si}</button>
        <button type="button" class="btn-borde" onclick={() => dialogos.pregunta?.responder(false)}>{dialogos.pregunta.no}</button>
      </div>
    </form>
  {/if}
</dialog>

<div class="avisos" aria-live="polite">
  {#each dialogos.avisos as a (a.id)}
    <div class="aviso {a.tipo}" role={a.tipo === 'error' ? 'alert' : 'status'}>
      <span>{a.texto}</span>
      <button class="cerrar" aria-label="Cerrar aviso" onclick={() => dialogos.quitar(a.id)}>×</button>
    </div>
  {/each}
</div>

<style>
  dialog {
    border: none;
    border-radius: var(--radio);
    padding: 22px;
    width: min(440px, calc(100vw - 32px));
    box-shadow: 0 10px 40px rgb(0 0 0 / 25%);
  }
  dialog::backdrop {
    background: rgb(20 20 20 / 45%);
  }
  dialog p {
    color: var(--suave);
    margin: 0 0 16px;
    white-space: pre-line;
  }
  .campo {
    margin-bottom: 16px;
  }
  .avisos {
    position: fixed;
    left: 50%;
    bottom: 16px;
    transform: translateX(-50%);
    display: grid;
    gap: 8px;
    width: min(460px, calc(100vw - 32px));
    z-index: 50;
  }
  .aviso {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 10px 10px 14px;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgb(0 0 0 / 20%);
    background: var(--carbon);
    color: var(--blanco);
  }
  .aviso.error {
    background: var(--rojo);
  }
  .cerrar {
    background: transparent;
    color: inherit;
    border: none;
    font-size: 1.3rem;
    padding: 0 8px;
    min-height: 32px;
  }
</style>
