<script lang="ts">
  /** Interruptor Sí / No. */
  let { valor = $bindable(), etiqueta, ayuda = '' }: { valor: boolean; etiqueta: string; ayuda?: string } = $props();
</script>

<label class="interruptor">
  <span class="textos">
    <span class="etiqueta">{etiqueta}</span>
    {#if ayuda}<span class="ayuda">{ayuda}</span>{/if}
  </span>
  <input type="checkbox" role="switch" bind:checked={valor} />
  <span class="pista" aria-hidden="true"><span class="bola"></span></span>
  <span class="estado" aria-hidden="true">{valor ? 'Sí' : 'No'}</span>
</label>

<style>
  .interruptor {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    color: var(--texto);
    font-weight: 400;
    font-size: 0.95rem;
    min-height: 42px;
    position: relative;
  }
  .textos {
    flex: 1;
    display: grid;
  }
  .etiqueta {
    font-weight: 600;
    color: var(--suave);
    font-size: 0.85rem;
  }
  .ayuda {
    margin: 0;
  }
  input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
  }
  .pista {
    width: 44px;
    height: 26px;
    border-radius: 999px;
    background: #cfc7b8;
    position: relative;
    transition: background 0.15s;
    flex: 0 0 auto;
  }
  .bola {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgb(0 0 0 / 30%);
    transition: transform 0.15s;
  }
  input:checked + .pista {
    background: var(--dorado-osc);
  }
  input:checked + .pista .bola {
    transform: translateX(18px);
  }
  input:focus-visible + .pista {
    outline: 2px solid var(--dorado);
    outline-offset: 2px;
  }
  .estado {
    width: 22px;
    font-weight: 700;
    font-size: 0.85rem;
  }
</style>
