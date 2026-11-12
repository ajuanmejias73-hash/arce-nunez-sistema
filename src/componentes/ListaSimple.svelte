<script lang="ts" module>
  /** Lista de nombres (tipos de trabajo, unidades, categorías…), con color opcional. */
  export interface Elemento {
    nombre: string;
    color?: string;
  }
</script>

<script lang="ts">
  import { dialogos } from '../lib/dialogos.svelte.ts';

  let {
    elementos,
    conColor = false,
    guardar,
    borrar,
  }: {
    elementos: Elemento[];
    conColor?: boolean;
    guardar: (original: string | null, nuevo: Elemento) => Promise<boolean>;
    borrar: (nombre: string) => Promise<boolean>;
  } = $props();

  let editando = $state<string | null>(null);
  let nombre = $state('');
  let color = $state('#7a7266');
  let ocupado = $state(false);

  async function empezar(e: Elemento | null) {
    if (editando !== null && !(await dialogos.confirmar('Hay un cambio sin guardar', '¿Dejarlo sin guardar?', { si: 'Sí, dejarlo' }))) return;
    nombre = e?.nombre ?? '';
    color = e?.color ?? '#7a7266';
    editando = e?.nombre ?? '';
  }

  async function confirmar() {
    const n = nombre.trim();
    if (!n) return dialogos.avisar('Escribí un nombre.', 'error');
    const original = editando || null;
    if (elementos.some((e) => e.nombre.toLowerCase() === n.toLowerCase() && e.nombre !== original)) return dialogos.avisar(`Ya existe «${n}».`, 'error');
    ocupado = true;
    try {
      if (await guardar(original, conColor ? { nombre: n, color } : { nombre: n })) editando = null;
    } finally {
      ocupado = false;
    }
  }

  async function quitar(e: Elemento) {
    const ok = await dialogos.confirmar(`¿Borrar «${e.nombre}»?`, 'Lo que ya está guardado con este nombre no cambia.', { si: 'Borrar', peligro: true });
    if (!ok) return;
    ocupado = true;
    try {
      await borrar(e.nombre);
    } finally {
      ocupado = false;
    }
  }

  function tecla(ev: KeyboardEvent) {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      confirmar();
    } else if (ev.key === 'Escape') editando = null;
  }
</script>

{#snippet editor()}
  <li class="editando">
    <!-- svelte-ignore a11y_autofocus -->
    <input bind:value={nombre} onkeydown={tecla} aria-label="Nombre" autofocus />
    {#if conColor}<input type="color" bind:value={color} aria-label="Color" />{/if}
    <button class="btn btn-chico" onclick={confirmar} disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
    <button class="btn-borde btn-chico" onclick={() => (editando = null)} disabled={ocupado}>Cancelar</button>
  </li>
{/snippet}

<div class="herramientas">
  <button class="btn-dorado" onclick={() => empezar(null)} disabled={editando === ''}>+ Nuevo</button>
  <span class="ayuda">{elementos.length} en la lista</span>
</div>

<ul class="lista">
  {#if editando === ''}{@render editor()}{/if}
  {#each elementos as e (e.nombre)}
    {#if editando === e.nombre}
      {@render editor()}
    {:else}
      <li>
        {#if conColor}<span class="muestra" style:background={e.color}>{e.nombre}</span>{:else}<span class="nombre">{e.nombre}</span>{/if}
        <button class="btn-borde btn-chico" onclick={() => empezar(e)} disabled={ocupado}>Editar</button>
        <button class="btn-peligro btn-chico" onclick={() => quitar(e)} disabled={ocupado}>Borrar</button>
      </li>
    {/if}
  {:else}
    {#if editando !== ''}<li class="vacio">La lista está vacía.</li>{/if}
  {/each}
</ul>

<style>
  .herramientas {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 12px;
  }
  .lista {
    list-style: none;
    margin: 0;
    padding: 0;
    max-width: 620px;
  }
  li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 4px;
    border-bottom: 1px solid var(--linea);
  }
  li.editando {
    background: #fbf8f1;
    padding: 8px;
  }
  li input:not([type='color']) {
    flex: 1;
    margin: 0;
  }
  li input[type='color'] {
    margin: 0;
  }
  .nombre {
    flex: 1;
  }
  .muestra {
    flex: 0 1 auto;
    margin-right: auto;
    color: #fff;
    padding: 3px 12px;
    border-radius: 999px;
    font-weight: 600;
    font-size: 0.9rem;
  }
  li.vacio {
    display: block;
  }
</style>
