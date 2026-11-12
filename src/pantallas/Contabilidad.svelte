<script lang="ts" module>
  const hoy = new Date();
  const seleccion = $state({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });
</script>

<script lang="ts">
  /** Resumen de la contabilidad (sección 10.4). */
  import { MESES, gastosPorCategoria, planillaSinPagar, porObra, resumenAnual, teDeben } from '../lib/contabilidad.ts';
  import { datos } from '../lib/datos.svelte.ts';
  import { colones, porcentaje } from '../lib/formato.ts';
  import { rutas } from '../lib/rutas.svelte.ts';
  import BotonesContables from '../componentes/BotonesContables.svelte';
  import GraficoAnual from '../componentes/GraficoAnual.svelte';

  const c = $derived(datos.c!);
  const anios = $derived([...new Set([hoy.getFullYear(), ...c.movimientos.map((m) => Number(m.fecha.slice(0, 4))).filter(Boolean)])].sort((a, b) => b - a));
  const anual = $derived(resumenAnual(seleccion.anio, c.movimientos));
  const mes = $derived(anual.meses[seleccion.mes - 1]);
  const categorias = $derived(gastosPorCategoria(seleccion.anio, seleccion.mes, c.movimientos));
  const obras = $derived(porObra(c.cotizaciones, c.movimientos, c.horas));
  const colores = $derived(new Map(c.ajustes.listas.estados.map((e) => [e.nombre, e.color])));
  const margen = (m: number | null) => (m === null ? '—' : porcentaje(m));
</script>

<div class="titulo">
  <h1>Contabilidad</h1>
  <div class="selector">
    <select bind:value={seleccion.mes} aria-label="Mes">{#each MESES as m, i}<option value={i + 1}>{m}</option>{/each}</select>
    <select bind:value={seleccion.anio} aria-label="Año">{#each anios as a}<option value={a}>{a}</option>{/each}</select>
  </div>
</div>

<BotonesContables />

<div class="tarjetas">
  <div class="tarjeta ind"><span>Ingresos de {mes.nombre.toLowerCase()}</span><strong>{colones(mes.ingresos)}</strong></div>
  <div class="tarjeta ind"><span>Gastos de {mes.nombre.toLowerCase()}</span><strong>{colones(mes.gastos)}</strong></div>
  <div class="tarjeta ind"><span>Ganancia de {mes.nombre.toLowerCase()}</span><strong class:negativo={mes.ganancia < 0}>{colones(mes.ganancia)}</strong></div>
  <div class="tarjeta ind"><span>Te deben (por cobrar)</span><strong>{colones(teDeben(c.cotizaciones, c.movimientos))}</strong></div>
  <div class="tarjeta ind"><span>Planilla sin pagar</span><strong>{colones(planillaSinPagar(c.horas))}</strong></div>
</div>

<section class="tarjeta seccion">
  <h2>Resumen de {seleccion.anio}</h2>
  <GraficoAnual meses={anual.meses} />
  <div class="tabla-envoltura">
    <table class="tabla">
      <thead><tr><th>Mes</th><th class="num">Ingresos</th><th class="num">Gastos</th><th class="num">Ganancia</th><th class="num">Margen</th></tr></thead>
      <tbody>
        {#each anual.meses as m}
          <tr class:actual={m.mes === seleccion.mes}>
            <td>{m.nombre}</td>
            <td class="num">{colones(m.ingresos)}</td>
            <td class="num">{colones(m.gastos)}</td>
            <td class="num" class:negativo={m.ganancia < 0}>{colones(m.ganancia)}</td>
            <td class="num">{margen(m.margen)}</td>
          </tr>
        {/each}
        <tr class="total">
          <td>Total {seleccion.anio}</td>
          <td class="num">{colones(anual.total.ingresos)}</td>
          <td class="num">{colones(anual.total.gastos)}</td>
          <td class="num" class:negativo={anual.total.ganancia < 0}>{colones(anual.total.ganancia)}</td>
          <td class="num">{margen(anual.total.margen)}</td>
        </tr>
      </tbody>
    </table>
  </div>
</section>

<section class="tarjeta seccion">
  <h2>Gastos por categoría</h2>
  <div class="tabla-envoltura">
    <table class="tabla apilable">
      <thead><tr><th>Categoría</th><th class="num">{mes.nombre}</th><th class="num">Año {seleccion.anio}</th><th class="num">% del año</th></tr></thead>
      <tbody>
        {#each categorias as x}
          <tr>
            <td data-etiqueta="Categoría">{x.categoria}</td>
            <td data-etiqueta={mes.nombre} class="num">{colones(x.mes)}</td>
            <td data-etiqueta="Año" class="num">{colones(x.anio)}</td>
            <td data-etiqueta="% del año" class="num">{porcentaje(x.porcentaje)}</td>
          </tr>
        {:else}
          <tr><td colspan="4" class="vacio sin-etiqueta">No hay gastos en {seleccion.anio}.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<section class="tarjeta seccion">
  <h2>Por obra</h2>
  <p class="ayuda">"Te debe" solo cuenta las obras Aceptadas, En proceso, Terminadas o Pagadas. Ganancia = cobrado − gastos de la obra.</p>
  <div class="tabla-envoltura">
    <table class="tabla apilable">
      <thead>
        <tr><th>N.º</th><th>Cliente</th><th>Estado</th><th class="num">Cotizado</th><th class="num">Cobrado</th><th class="num">Te debe</th><th class="num">Gastos</th><th class="num">Ganancia</th><th class="num">Planilla sin pagar</th></tr>
      </thead>
      <tbody>
        {#each obras as o (o.numero)}
          <tr>
            <td data-etiqueta="N.º"><button class="enlace" onclick={() => rutas.ir('ver/' + o.numero)}>{o.numero}</button></td>
            <td data-etiqueta="Cliente">{o.cliente}</td>
            <td data-etiqueta="Estado"><span class="estado" style:background={colores.get(o.estado) ?? '#7a7266'}>{o.estado}</span></td>
            <td data-etiqueta="Cotizado" class="num">{colones(o.total)}</td>
            <td data-etiqueta="Cobrado" class="num">{colones(o.cobrado)}</td>
            <td data-etiqueta="Te debe" class="num"><strong>{colones(o.debe)}</strong></td>
            <td data-etiqueta="Gastos" class="num">{colones(o.gastos)}</td>
            <td data-etiqueta="Ganancia" class="num" class:negativo={o.ganancia < 0}>{colones(o.ganancia)}</td>
            <td data-etiqueta="Planilla sin pagar" class="num">{colones(o.planilla)}</td>
          </tr>
        {:else}
          <tr><td colspan="9" class="vacio sin-etiqueta">Todavía no hay obras aceptadas ni movimientos.</td></tr>
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
  .selector {
    display: flex;
    gap: 8px;
  }
  .selector select {
    width: auto;
    margin: 0;
  }
  .tarjetas {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
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
    font-size: 1.3rem;
  }
  .negativo {
    color: var(--rojo);
  }
  .seccion {
    margin-top: 16px !important;
  }
  tr.actual td {
    background: #fbf6ec;
    font-weight: 700;
  }
  tr.total td {
    font-weight: 700;
    border-top: 2px solid var(--carbon);
  }
  .estado {
    color: #fff;
    border-radius: 999px;
    padding: 2px 10px;
    font-size: 0.8rem;
    font-weight: 700;
  }
  .enlace {
    background: none;
    border: none;
    padding: 0;
    min-height: 0;
    color: var(--dorado-osc);
    text-decoration: underline;
    font-weight: 700;
  }
</style>
