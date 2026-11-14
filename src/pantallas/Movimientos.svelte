<script lang="ts" module>
  const filtro = $state({ texto: '', tipo: '', categoria: '', obra: '', desde: '', hasta: '' });
</script>

<script lang="ts">
  /** Libro de ingresos y gastos (sección 10.1). */
  import { borrarMovimiento } from '../lib/acciones-contables.ts';
  import { totales } from '../lib/contabilidad.ts';
  import { datos } from '../lib/datos.svelte.ts';
  import { dialogos } from '../lib/dialogos.svelte.ts';
  import { colones, fecha } from '../lib/formato.ts';
  import { rutas } from '../lib/rutas.svelte.ts';
  import type { Movimiento } from '../lib/tipos.ts';
  import BotonesContables from '../componentes/BotonesContables.svelte';

  const c = $derived(datos.c!);
  const categorias = $derived([...new Set([...c.ajustes.listas.categoriasIngreso, ...c.ajustes.listas.categoriasGasto, ...c.movimientos.map((m) => m.categoria)])].filter(Boolean));
  const filas = $derived.by(() => {
    const q = filtro.texto.trim().toLowerCase();
    return c.movimientos
      .filter((m) => {
        if (filtro.tipo && m.tipo !== filtro.tipo) return false;
        if (filtro.categoria && m.categoria !== filtro.categoria) return false;
        if (filtro.obra && m.cotizacion !== filtro.obra) return false;
        if (filtro.desde && m.fecha < filtro.desde) return false;
        if (filtro.hasta && m.fecha > filtro.hasta) return false;
        if (q && ![m.descripcion, m.persona, m.categoria, m.cotizacion, m.comprobante, m.notas].some((t) => t.toLowerCase().includes(q))) return false;
        return true;
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.registrado.localeCompare(a.registrado));
  });
  const t = $derived(totales(filas));
  const hayFiltro = $derived(Object.values(filtro).some(Boolean));

  let editar = $state<Movimiento | null>(null);

  async function borrar(m: Movimiento) {
    const extra = m.pagoPlanilla ? '\nEste gasto salió de "Pagar planilla": esas horas vuelven a quedar sin pagar.' : '';
    const ok = await dialogos.confirmar(`¿Borrar este ${m.tipo === 'Gasto' ? 'gasto' : 'ingreso'}?`, `${fecha(m.fecha)} · ${m.categoria} · ${colones(m.monto)}${extra}`, { si: 'Borrar', peligro: true });
    if (!ok) return;
    try {
      await borrarMovimiento(m);
      dialogos.avisar('Borrado');
    } catch (e) {
      dialogos.fallo(e);
    }
  }

  function limpiar() {
    Object.assign(filtro, { texto: '', tipo: '', categoria: '', obra: '', desde: '', hasta: '' });
  }
</script>

<h1>Pagos y gastos</h1>
<BotonesContables bind:editar />

<div class="indicadores">
  <div class="tarjeta ind"><span>Ingresos</span><strong class="verde">{colones(t.ingresos)}</strong></div>
  <div class="tarjeta ind"><span>Gastos</span><strong class="rojo">{colones(t.gastos)}</strong></div>
  <div class="tarjeta ind"><span>Balance</span><strong>{colones(t.balance)}</strong></div>
</div>
{#if hayFiltro}<p class="ayuda">Los totales cuentan solo lo que muestra el filtro.</p>{/if}

<section class="tarjeta filtros">
  <label class="buscar">Buscar <input type="search" bind:value={filtro.texto} placeholder="Descripción, persona, comprobante…" /></label>
  <label>
    Tipo
    <select bind:value={filtro.tipo}><option value="">Todos</option><option>Ingreso</option><option>Gasto</option></select>
  </label>
  <label>
    Categoría
    <select bind:value={filtro.categoria}><option value="">Todas</option>{#each categorias as x}<option>{x}</option>{/each}</select>
  </label>
  <label>
    Obra
    <select bind:value={filtro.obra}><option value="">Todas</option>{#each c.cotizaciones as x}<option value={x.numero}>{x.numero} · {x.cliente}</option>{/each}</select>
  </label>
  <label>Desde <input type="date" bind:value={filtro.desde} /></label>
  <label>Hasta <input type="date" bind:value={filtro.hasta} /></label>
  {#if hayFiltro}<button class="btn-borde" onclick={limpiar}>Quitar filtros</button>{/if}
</section>

<section class="tarjeta">
  <div class="tabla-envoltura">
    <table class="tabla apilable">
      <thead>
        <tr>
          <th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Descripción</th><th>Obra</th><th>Persona</th><th>Método</th><th class="num">Monto</th><th>Comprobante</th><th>Registró</th><th><span class="oculto-visual">Acciones</span></th>
        </tr>
      </thead>
      <tbody>
        {#each filas as m (m.id)}
          <tr>
            <td data-etiqueta="Fecha">{fecha(m.fecha)}</td>
            <td data-etiqueta="Tipo"><span class="tipo" class:gasto={m.tipo === 'Gasto'}>{m.tipo}</span></td>
            <td data-etiqueta="Categoría">{m.categoria}</td>
            <td data-etiqueta="Descripción">{#if m.estimado}<span class="estimado" title="Salió de la cotización al aceptarse: editalo con el monto real">Estimado</span> {/if}{m.descripcion}{#if m.notas}<small class="nota">{m.notas}</small>{/if}</td>
            <td data-etiqueta="Obra">{#if m.cotizacion}<button class="enlace" onclick={() => rutas.ir('ver/' + m.cotizacion)}>{m.cotizacion}</button>{/if}</td>
            <td data-etiqueta="Persona">{m.persona}</td>
            <td data-etiqueta="Método">{m.metodo}</td>
            <td data-etiqueta="Monto" class="num"><strong class:rojo={m.tipo === 'Gasto'} class:verde={m.tipo === 'Ingreso'}>{m.tipo === 'Gasto' ? '−' : '+'}{colones(m.monto)}</strong></td>
            <td data-etiqueta="Comprobante">{m.comprobante}</td>
            <td data-etiqueta="Registró">{m.registradoPor}</td>
            <td class="sin-etiqueta">
              <div class="acciones fila">
                <button class="btn-borde btn-chico" onclick={() => (editar = m)}>Editar</button>
                <button class="btn-peligro btn-chico" onclick={() => borrar(m)}>Borrar</button>
              </div>
            </td>
          </tr>
        {:else}
          <tr><td colspan="11" class="vacio sin-etiqueta">{c.movimientos.length ? 'Nada coincide con el filtro.' : 'Todavía no hay pagos ni gastos. Usá los botones de arriba.'}</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<style>
  .indicadores {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
    margin-top: 16px;
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
  .verde {
    color: #22603a;
  }
  .rojo {
    color: var(--rojo);
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
    flex: 0 1 160px;
  }
  .filtros .buscar {
    flex: 1 1 220px;
  }
  .tipo {
    background: #e2f0e6;
    color: #22603a;
    border-radius: 999px;
    padding: 2px 10px;
    font-size: 0.8rem;
    font-weight: 700;
  }
  .tipo.gasto {
    background: #fbefed;
    color: var(--rojo);
  }
  .estimado {
    background: #fff1c9;
    color: #6b4d00;
    border-radius: 999px;
    padding: 1px 8px;
    font-size: 0.75rem;
    font-weight: 700;
  }
  .nota {
    display: block;
    color: var(--suave);
  }
  .enlace {
    background: none;
    border: none;
    padding: 0;
    min-height: 0;
    color: var(--dorado-osc);
    text-decoration: underline;
    font-weight: 600;
  }
  .fila {
    flex-wrap: nowrap;
  }
</style>
