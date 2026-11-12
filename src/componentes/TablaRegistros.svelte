<script lang="ts" module>
  export interface Columna {
    campo: string;
    titulo: string;
    tipo: 'texto' | 'dinero' | 'numero' | 'opciones';
    /** Para tipo "opciones". */
    opciones?: string[];
    /** Campo obligatorio (el primero siempre lo es: es el nombre). */
    obligatorio?: boolean;
  }
</script>

<script lang="ts">
  import { aNumero, colones } from '../lib/formato.ts';
  import { dialogos } from '../lib/dialogos.svelte.ts';

  type Registro = Record<string, unknown>;

  let {
    registros,
    columnas,
    nombreSingular,
    guardar,
    borrar,
  }: {
    registros: Registro[];
    columnas: Columna[];
    nombreSingular: string;
    /** `original` = nombre antes de editar (null si es nuevo). */
    guardar: (original: string | null, nuevo: Registro) => Promise<boolean>;
    borrar: (nombre: string) => Promise<boolean>;
  } = $props();

  const clave = $derived(columnas[0].campo);

  let buscar = $state('');
  /** Nombre del registro que se está editando ('' = uno nuevo, null = ninguno). */
  let editando = $state<string | null>(null);
  let borrador = $state<Record<string, string>>({});
  let ocupado = $state(false);

  const filtrados = $derived.by(() => {
    const q = buscar.trim().toLowerCase();
    if (!q) return registros;
    return registros.filter((r) => columnas.some((c) => String(r[c.campo] ?? '').toLowerCase().includes(q)));
  });

  function mostrar(r: Registro, c: Columna): string {
    const v = r[c.campo];
    if (c.tipo === 'dinero') return v === null || v === undefined ? '—' : colones(v as number);
    if (v === null || v === undefined || v === '') return c.tipo === 'numero' ? '—' : '';
    return String(v);
  }

  async function empezar(r: Registro | null) {
    if (editando !== null && !(await dialogos.confirmar('Hay una fila sin guardar', '¿Dejarla sin guardar?', { si: 'Sí, dejarla' }))) return;
    const b: Record<string, string> = {};
    for (const c of columnas) {
      const v = r?.[c.campo];
      b[c.campo] = v === null || v === undefined ? '' : String(v);
    }
    if (!r) for (const c of columnas) if (c.tipo === 'opciones' && c.obligatorio && c.opciones?.length) b[c.campo] = c.opciones[0];
    borrador = b;
    editando = r ? String(r[clave]) : '';
  }

  function cancelar() {
    editando = null;
  }

  async function confirmarFila() {
    const nuevo: Registro = {};
    for (const c of columnas) {
      const t = (borrador[c.campo] ?? '').trim();
      if ((c.obligatorio || c.campo === clave) && !t) {
        dialogos.avisar(`Falta «${c.titulo}».`, 'error');
        return;
      }
      if (c.tipo === 'dinero' || c.tipo === 'numero') {
        const n = aNumero(t);
        if (t && (n === null || n < 0)) {
          dialogos.avisar(`«${c.titulo}» debe ser un número.`, 'error');
          return;
        }
        nuevo[c.campo] = n;
      } else {
        nuevo[c.campo] = t;
      }
    }
    const original = editando || null;
    const nombre = String(nuevo[clave]).toLowerCase();
    if (registros.some((r) => String(r[clave]).toLowerCase() === nombre && String(r[clave]) !== original)) {
      dialogos.avisar(`Ya existe «${nuevo[clave]}».`, 'error');
      return;
    }
    ocupado = true;
    try {
      if (await guardar(original, nuevo)) editando = null;
    } finally {
      ocupado = false;
    }
  }

  async function quitar(r: Registro) {
    const nombre = String(r[clave]);
    const ok = await dialogos.confirmar(`¿Borrar «${nombre}»?`, 'Las cotizaciones ya guardadas no cambian.', { si: 'Borrar', peligro: true });
    if (!ok) return;
    ocupado = true;
    try {
      await borrar(nombre);
    } finally {
      ocupado = false;
    }
  }

  function teclaFila(ev: KeyboardEvent) {
    if (ev.key === 'Enter' && (ev.target as HTMLElement).tagName === 'INPUT') {
      ev.preventDefault();
      confirmarFila();
    } else if (ev.key === 'Escape') cancelar();
  }
</script>

{#snippet filaEditable()}
  <tr class="editando" onkeydown={teclaFila}>
    {#each columnas as c, i}
      <td data-etiqueta={c.titulo}>
        {#if c.tipo === 'opciones'}
          <select bind:value={borrador[c.campo]} aria-label={c.titulo}>
            {#if !c.obligatorio}<option value="">—</option>{/if}
            {#if borrador[c.campo] && !c.opciones?.includes(borrador[c.campo])}<option>{borrador[c.campo]}</option>{/if}
            {#each c.opciones ?? [] as op}<option>{op}</option>{/each}
          </select>
        {:else}
          <!-- svelte-ignore a11y_autofocus -->
          <input
            bind:value={borrador[c.campo]}
            aria-label={c.titulo}
            inputmode={c.tipo === 'texto' ? 'text' : 'decimal'}
            autofocus={i === 0}
            placeholder={c.tipo === 'dinero' ? '₡' : ''}
          />
        {/if}
      </td>
    {/each}
    <td class="sin-etiqueta">
      <div class="acciones fila-acciones">
        <button class="btn btn-chico" onclick={confirmarFila} disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
        <button class="btn-borde btn-chico" onclick={cancelar} disabled={ocupado}>Cancelar</button>
      </div>
    </td>
  </tr>
{/snippet}

<div class="herramientas">
  <input type="search" bind:value={buscar} placeholder="Buscar…" aria-label="Buscar" />
  <button class="btn-dorado" onclick={() => empezar(null)} disabled={editando === ''}>+ Nuevo</button>
  <span class="ayuda">{filtrados.length} de {registros.length}</span>
</div>

<div class="tabla-envoltura">
  <table class="tabla apilable">
    <thead>
      <tr>
        {#each columnas as c}<th class:num={c.tipo === 'dinero' || c.tipo === 'numero'}>{c.titulo}</th>{/each}
        <th><span class="oculto-visual">Acciones</span></th>
      </tr>
    </thead>
    <tbody>
      {#if editando === ''}{@render filaEditable()}{/if}
      {#each filtrados as r (String(r[clave]))}
        {#if editando === String(r[clave])}
          {@render filaEditable()}
        {:else}
          <tr>
            {#each columnas as c, i}
              <td data-etiqueta={c.titulo} class:num={c.tipo === 'dinero' || c.tipo === 'numero'} class:nombre={i === 0}>{mostrar(r, c)}</td>
            {/each}
            <td class="sin-etiqueta">
              <div class="acciones fila-acciones">
                <button class="btn-borde btn-chico" onclick={() => empezar(r)} disabled={ocupado}>Editar</button>
                <button class="btn-peligro btn-chico" onclick={() => quitar(r)} disabled={ocupado}>Borrar</button>
              </div>
            </td>
          </tr>
        {/if}
      {:else}
        {#if editando !== ''}
          <tr><td colspan={columnas.length + 1} class="vacio sin-etiqueta">{buscar ? 'Nada coincide con la búsqueda.' : `Todavía no hay ${nombreSingular}s. Tocá "+ Nuevo".`}</td></tr>
        {/if}
      {/each}
    </tbody>
  </table>
</div>

<style>
  .herramientas {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .herramientas input {
    flex: 1 1 220px;
    margin: 0;
  }
  .fila-acciones {
    justify-content: flex-end;
    flex-wrap: nowrap;
  }
  td.nombre {
    font-weight: 600;
  }
  @container tabla (max-width: 880px) {
    .fila-acciones {
      justify-content: flex-start;
    }
  }
</style>
