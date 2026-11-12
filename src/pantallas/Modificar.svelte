<script lang="ts">
  import { modificar as modificarCotizacion } from '../lib/abrir.ts';
  import { ultimaVersion } from '../lib/cotizacion.ts';
  import { datos } from '../lib/datos.svelte.ts';
  import { editor } from '../lib/editor.svelte.ts';
  import { colones, fecha } from '../lib/formato.ts';
  import { rutas } from '../lib/rutas.svelte.ts';
  import type { Cotizacion } from '../lib/tipos.ts';

  let buscar = $state('');

  const c = $derived(datos.c!);
  const colores = $derived(new Map(c.ajustes.listas.estados.map((e) => [e.nombre, e.color])));
  const filas = $derived.by(() => {
    const q = buscar.trim().toLowerCase();
    return [...c.cotizaciones]
      .sort((a, b) => b.numero.localeCompare(a.numero, 'es', { numeric: true }))
      .map((x) => ({ c: x, v: ultimaVersion(x) }))
      .filter(({ c: x, v }) => !q || [x.numero, x.cliente, v.datos.ubicacion, v.datos.trabajoSolicitado].some((t) => t.toLowerCase().includes(q)));
  });

  function modificar(x: Cotizacion) {
    // Si ya está abierta (con o sin cambios), seguir con esa.
    if (editor.d && editor.base?.numero === x.numero) return rutas.ir('cotizacion');
    modificarCotizacion(x);
  }
</script>

<h1>Modificar cotización</h1>
<p class="ayuda">Se abre su última versión. Al guardar, queda como la versión siguiente (v2, v3…) y la anterior no se borra.</p>

<!-- svelte-ignore a11y_autofocus -->
<input type="search" bind:value={buscar} placeholder="Buscar por número, cliente, lugar o trabajo…" aria-label="Buscar cotización" autofocus class="buscar" />

<ul class="lista">
  {#each filas as { c: x, v } (x.numero)}
    <li>
      <button onclick={() => modificar(x)}>
        <span class="numero">{x.numero}</span>
        <span class="info">
          <strong>{x.cliente}</strong>
          <small>{[v.datos.trabajoSolicitado, v.datos.ubicacion].filter(Boolean).join(' · ')}</small>
          <small>{fecha(v.datos.fecha)} · v{x.versionActual} · {colones(v.total)}</small>
        </span>
        <span class="estado" style:background={colores.get(x.estado) ?? '#7a7266'}>{x.estado}</span>
        {#if editor.base?.numero === x.numero && editor.sinGuardar}<span class="abierta">Abierta, sin guardar</span>{/if}
      </button>
    </li>
  {:else}
    <li class="vacio">{c.cotizaciones.length ? 'Ninguna coincide con la búsqueda.' : 'Todavía no hay cotizaciones guardadas.'}</li>
  {/each}
</ul>

<style>
  .buscar {
    margin: 12px 0;
  }
  .lista {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 8px;
  }
  .lista button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    text-align: left;
    background: var(--blanco);
    border: 1px solid var(--linea);
    font-weight: 400;
    color: var(--texto);
    padding: 12px 14px;
  }
  .lista button:hover {
    border-color: var(--dorado);
  }
  .numero {
    font-weight: 700;
    color: var(--dorado-osc);
    min-width: 84px;
  }
  .info {
    flex: 1;
    display: grid;
    min-width: 180px;
  }
  .info small {
    color: var(--suave);
  }
  .estado {
    color: #fff;
    border-radius: 999px;
    padding: 2px 12px;
    font-size: 0.82rem;
    font-weight: 700;
  }
  .abierta {
    background: #fff1c9;
    color: #6b4d00;
    border-radius: 999px;
    padding: 2px 10px;
    font-size: 0.78rem;
    font-weight: 700;
  }
</style>
