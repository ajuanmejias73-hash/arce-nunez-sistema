<script lang="ts">
  /** Lista desplegable del estado de una cotización, con su color. Guarda al cambiar. */
  import { cambiarEstado } from '../lib/abrir.ts';
  import { datos } from '../lib/datos.svelte.ts';
  import type { Cotizacion } from '../lib/tipos.ts';

  let { c }: { c: Cotizacion } = $props();

  const estados = $derived(datos.c?.ajustes.listas.estados ?? []);
  const color = $derived(estados.find((e) => e.nombre === c.estado)?.color ?? '#7a7266');
  let guardando = $state(false);

  async function cambiar(ev: Event) {
    const nuevo = (ev.currentTarget as HTMLSelectElement).value;
    if (nuevo === c.estado) return;
    guardando = true;
    try {
      await cambiarEstado(c.numero, nuevo);
    } finally {
      guardando = false;
    }
  }
</script>

<select class="estado" style:background={color} value={c.estado} onchange={cambiar} disabled={guardando} aria-label="Estado de {c.numero}">
  {#if !estados.some((e) => e.nombre === c.estado)}<option>{c.estado}</option>{/if}
  {#each estados as e}<option value={e.nombre}>{e.nombre}</option>{/each}
</select>

<style>
  .estado {
    color: #fff;
    font-weight: 700;
    border: none;
    border-radius: 999px;
    padding: 4px 26px 4px 12px;
    min-height: 32px;
    width: auto;
    margin: 0;
    font-size: 0.85rem;
    cursor: pointer;
    appearance: none;
    background-image: linear-gradient(45deg, transparent 50%, #fff 50%), linear-gradient(135deg, #fff 50%, transparent 50%);
    background-size: 5px 5px, 5px 5px;
    background-position: calc(100% - 13px) 55%, calc(100% - 8px) 55%;
    background-repeat: no-repeat;
  }
  .estado option {
    color: var(--texto);
    background: var(--blanco);
  }
</style>
