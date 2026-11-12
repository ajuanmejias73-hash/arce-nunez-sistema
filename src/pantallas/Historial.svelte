<script lang="ts" module>
  // Los filtros se mantienen mientras se navega entre pantallas.
  const filtro = $state({ texto: '', estado: '', desde: '', hasta: '' });
</script>

<script lang="ts">
  import { modificar, usarDeBase } from '../lib/abrir.ts';
  import { filtrarHistorial, indicadores, ultimaVersion } from '../lib/cotizacion.ts';
  import { datos } from '../lib/datos.svelte.ts';
  import { colones, fecha } from '../lib/formato.ts';
  import { rutas } from '../lib/rutas.svelte.ts';
  import SelectorEstado from '../componentes/SelectorEstado.svelte';

  const c = $derived(datos.c!);
  const filas = $derived(filtrarHistorial(c.cotizaciones, filtro));
  const ind = $derived(indicadores(filas));
  const hayFiltro = $derived(!!(filtro.texto || filtro.estado || filtro.desde || filtro.hasta));

  function limpiar() {
    Object.assign(filtro, { texto: '', estado: '', desde: '', hasta: '' });
  }
</script>

<div class="titulo">
  <h1>Historial</h1>
  <button class="btn-dorado" onclick={() => rutas.ir('nueva')}>+ Nueva cotización</button>
</div>

<div class="indicadores">
  <div class="tarjeta ind"><span>Cotizaciones</span><strong>{ind.cantidad}</strong></div>
  <div class="tarjeta ind"><span>Monto cotizado</span><strong>{colones(ind.cotizado)}</strong></div>
  <div class="tarjeta ind"><span>Aceptado o en curso</span><strong>{colones(ind.aceptado)}</strong></div>
  <div class="tarjeta ind"><span>Pendientes</span><strong>{ind.pendientes}</strong><small>{colones(ind.montoPendiente)}</small></div>
</div>
{#if hayFiltro}<p class="ayuda">Los indicadores cuentan solo lo que muestra el filtro.</p>{/if}

<section class="tarjeta filtros">
  <label class="buscar">Buscar <input type="search" bind:value={filtro.texto} placeholder="Cliente, número, lugar, trabajo…" /></label>
  <label>
    Estado
    <select bind:value={filtro.estado}>
      <option value="">Todos</option>
      {#each c.ajustes.listas.estados as e}<option value={e.nombre}>{e.nombre}</option>{/each}
    </select>
  </label>
  <label>Desde <input type="date" bind:value={filtro.desde} /></label>
  <label>Hasta <input type="date" bind:value={filtro.hasta} /></label>
  {#if hayFiltro}<button class="btn-borde" onclick={limpiar}>Quitar filtros</button>{/if}
</section>

<section class="tarjeta contenedor">
  <!-- En pantallas angostas: tarjetas compactas -->
  <ul class="compactas">
    {#each filas as x (x.numero)}
      {@const v = ultimaVersion(x)}
      <li>
        <div class="fila-arriba">
          <span><strong class="numero">{x.numero}</strong> · <strong>{x.cliente}</strong></span>
          <SelectorEstado c={x} />
        </div>
        <div class="detalle">{[v.datos.trabajoSolicitado, v.datos.ubicacion].filter(Boolean).join(' · ')}</div>
        <div class="detalle">
          {fecha(v.datos.fecha)} · v{x.versionActual} · <strong class="monto">{colones(v.total)}</strong>
          {#if v.datos.telefono}· {v.datos.telefono}{/if}
        </div>
        {#if x.notasInternas}<div class="nota-int">📝 {x.notasInternas}</div>{/if}
        <div class="acciones">
          <button class="btn btn-chico" onclick={() => rutas.ir('ver/' + x.numero)}>Abrir</button>
          <button class="btn-borde btn-chico" onclick={() => modificar(x)}>Modificar</button>
          <button class="btn-borde btn-chico" onclick={() => usarDeBase(x)}>Usar de base</button>
          {#if x.versiones.length > 1}
            <button class="btn-borde btn-chico" onclick={() => rutas.ir(`ver/${x.numero}/versiones`)}>Versiones ({x.versiones.length})</button>
          {/if}
        </div>
      </li>
    {:else}
      <li class="vacio">{c.cotizaciones.length ? 'Ninguna cotización coincide con el filtro.' : 'Todavía no hay cotizaciones.'}</li>
    {/each}
  </ul>

  <div class="tabla-envoltura ancha">
    <table class="tabla">
      <thead>
        <tr>
          <th>N.º</th>
          <th>Fecha</th>
          <th>Cliente</th>
          <th>Ubicación</th>
          <th>Trabajo</th>
          <th>Modo</th>
          <th class="num">Total</th>
          <th class="num">Adelanto</th>
          <th>Estado</th>
          <th>Notas</th>
          <th><span class="oculto-visual">Acciones</span></th>
        </tr>
      </thead>
      <tbody>
        {#each filas as x (x.numero)}
          {@const v = ultimaVersion(x)}
          <tr>
            <td class="numero">{x.numero}<small class="ver">v{x.versionActual}</small></td>
            <td data-etiqueta="Fecha">{fecha(v.datos.fecha)}</td>
            <td data-etiqueta="Cliente">
              <strong>{x.cliente}</strong>
              {#if v.datos.telefono}<small class="tel">{v.datos.telefono}</small>{/if}
            </td>
            <td data-etiqueta="Ubicación">{v.datos.ubicacion}</td>
            <td data-etiqueta="Trabajo">{v.datos.trabajoSolicitado}</td>
            <td data-etiqueta="Modo">{v.datos.modoPrecio === 'Total a mano' ? 'Total' : 'Partes'}</td>
            <td data-etiqueta="Total" class="num"><strong>{colones(v.total)}</strong></td>
            <td data-etiqueta="Adelanto" class="num">{colones(v.adelanto)}</td>
            <td data-etiqueta="Estado"><SelectorEstado c={x} /></td>
            <td data-etiqueta="Notas" class="notas" title={x.notasInternas ?? ''}>{x.notasInternas ?? ''}</td>
            <td class="sin-etiqueta">
              <div class="acciones fila">
                <button class="btn btn-chico" onclick={() => rutas.ir('ver/' + x.numero)}>Abrir</button>
                <button class="btn-borde btn-chico" onclick={() => modificar(x)}>Modificar</button>
                <button class="btn-borde btn-chico" onclick={() => usarDeBase(x)} title="Cotización nueva (número y fecha nuevos) con estos mismos datos">Usar de base</button>
                {#if x.versiones.length > 1}
                  <button class="btn-borde btn-chico" onclick={() => rutas.ir(`ver/${x.numero}/versiones`)}>Versiones ({x.versiones.length})</button>
                {/if}
              </div>
            </td>
          </tr>
        {:else}
          <tr><td colspan="11" class="vacio sin-etiqueta">{c.cotizaciones.length ? 'Ninguna cotización coincide con el filtro.' : 'Todavía no hay cotizaciones.'}</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<style>
  .titulo {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .titulo h1 {
    margin: 0;
  }
  .indicadores {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
  }
  .ind {
    display: grid;
    gap: 2px;
    padding: 14px;
    margin: 0 !important;
  }
  .ind span {
    color: var(--suave);
    font-size: 0.85rem;
  }
  .ind strong {
    font-size: 1.35rem;
  }
  .ind small {
    color: var(--suave);
  }
  .filtros {
    display: flex;
    gap: 12px;
    align-items: flex-end;
    flex-wrap: wrap;
    margin: 16px 0;
    padding: 14px;
  }
  .filtros label {
    flex: 0 1 170px;
  }
  .filtros .buscar {
    flex: 1 1 240px;
  }
  .numero {
    font-weight: 700;
    color: var(--dorado-osc);
    white-space: nowrap;
  }
  .tel {
    display: block;
    color: var(--suave);
  }
  .notas {
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--suave);
    font-size: 0.85rem;
  }
  .fila {
    display: grid;
    gap: 4px;
    width: 112px;
  }
  .ver {
    display: block;
    color: var(--suave);
    font-weight: 400;
  }

  /* Tabla en pantallas anchas, tarjetas compactas en las angostas. */
  .contenedor {
    container: historial / inline-size;
  }
  .compactas {
    display: none;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .compactas li {
    border-bottom: 1px solid var(--linea);
    padding: 12px 0;
    display: grid;
    gap: 4px;
  }
  .compactas li:last-child {
    border-bottom: none;
  }
  .fila-arriba {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .detalle {
    color: var(--suave);
    font-size: 0.9rem;
  }
  .monto {
    color: var(--texto);
  }
  .nota-int {
    font-size: 0.85rem;
    background: var(--fondo);
    border-radius: 6px;
    padding: 4px 8px;
  }
  .compactas .acciones {
    margin-top: 4px;
  }
  @container historial (max-width: 1000px) {
    .compactas {
      display: block;
    }
    .ancha {
      display: none;
    }
  }
</style>
