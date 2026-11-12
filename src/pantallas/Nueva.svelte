<script lang="ts">
  import { abrirEnEditor, puedeReemplazar } from '../lib/abrir.ts';
  import { clientes, datosNuevos, siguienteNumero } from '../lib/cotizacion.ts';
  import { datos } from '../lib/datos.svelte.ts';
  import { editor } from '../lib/editor.svelte.ts';
  import { rutas } from '../lib/rutas.svelte.ts';

  let paso = $state<'escoger' | 'cliente'>('escoger');
  let buscar = $state('');

  const c = $derived(datos.c!);
  const numero = $derived(siguienteNumero(c.cotizaciones, c.ajustes.porDefecto.prefijo));
  const lista = $derived(clientes(c.cotizaciones));
  const filtrados = $derived.by(() => {
    const q = buscar.trim().toLowerCase();
    return q ? lista.filter((x) => [x.cliente, x.telefono, x.ubicacion].some((v) => v.toLowerCase().includes(q))) : lista;
  });

  async function clienteNuevo() {
    if (!(await puedeReemplazar())) return;
    abrirEnEditor(datosNuevos(c.ajustes, numero), null);
  }

  async function clienteExistente(x: (typeof lista)[number]) {
    if (!(await puedeReemplazar())) return;
    abrirEnEditor(datosNuevos(c.ajustes, numero, x), null);
  }
</script>

<h1>Nueva cotización</h1>
<p class="ayuda">Va a ser la <strong>{numero}</strong>.</p>

{#if editor.d && editor.sinGuardar}
  <div class="abierta">
    Tenés abierta <strong>{editor.d.numero}{editor.d.cliente.trim() ? ' · ' + editor.d.cliente.trim() : ''}</strong> con cambios sin guardar.
    <button class="btn-borde btn-chico" onclick={() => rutas.ir('cotizacion')}>Seguir con esa</button>
  </div>
{/if}

{#if paso === 'escoger'}
  <div class="opciones">
    <button class="tarjeta opcion" onclick={clienteNuevo}>
      <strong>Cliente nuevo</strong>
      <span>Empieza en blanco, con los valores por defecto de Ajustes.</span>
    </button>
    <button class="tarjeta opcion" onclick={() => (paso = 'cliente')} disabled={!lista.length}>
      <strong>Cliente existente</strong>
      <span>{lista.length ? `Escoger de los ${lista.length} clientes: se llenan nombre, teléfono y ubicación.` : 'Todavía no hay clientes guardados.'}</span>
    </button>
  </div>
{:else}
  <section class="tarjeta">
    <div class="tarjeta-titulo">
      <h2>¿Para cuál cliente?</h2>
      <button class="btn-borde btn-chico" onclick={() => (paso = 'escoger')}>← Volver</button>
    </div>
    <!-- svelte-ignore a11y_autofocus -->
    <input type="search" bind:value={buscar} placeholder="Buscar por nombre, teléfono o lugar…" aria-label="Buscar cliente" autofocus />
    <ul class="lista">
      {#each filtrados as x (x.cliente)}
        <li>
          <button onclick={() => clienteExistente(x)}>
            <strong>{x.cliente}</strong>
            <span>{[x.telefono, x.ubicacion].filter(Boolean).join(' · ') || 'Sin teléfono ni ubicación'}</span>
            <small>{x.numeros.join(', ')}</small>
          </button>
        </li>
      {:else}
        <li class="vacio">Ningún cliente coincide.</li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .opciones {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 14px;
    margin-top: 16px;
  }
  .opcion {
    text-align: left;
    display: grid;
    gap: 6px;
    font-weight: 400;
    color: var(--texto);
    padding: 22px;
  }
  .opcion:hover:not(:disabled) {
    border-color: var(--dorado);
  }
  .opcion strong {
    font-size: 1.2rem;
  }
  .opcion span {
    color: var(--suave);
  }
  .abierta {
    background: #fff1c9;
    border: 1px solid #ecd58f;
    border-radius: 8px;
    padding: 10px 12px;
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    margin: 12px 0;
  }
  .lista {
    list-style: none;
    padding: 0;
    margin: 12px 0 0;
    display: grid;
    gap: 6px;
  }
  .lista button {
    width: 100%;
    text-align: left;
    display: grid;
    gap: 2px;
    background: var(--blanco);
    border: 1px solid var(--linea);
    font-weight: 400;
    color: var(--texto);
  }
  .lista button:hover {
    border-color: var(--dorado);
  }
  .lista span,
  .lista small {
    color: var(--suave);
  }
</style>
