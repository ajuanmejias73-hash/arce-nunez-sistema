<script lang="ts" module>
  const filtro = $state({ trabajador: '', pagado: '' });
</script>

<script lang="ts">
  /** Planilla (sección 10.3): trabajadores y registro de horas. */
  import { borrarHora } from '../lib/acciones-contables.ts';
  import { planillaSinPagar, resumenTrabajador, totalHora } from '../lib/contabilidad.ts';
  import { datos } from '../lib/datos.svelte.ts';
  import { dialogos } from '../lib/dialogos.svelte.ts';
  import { colones, fecha } from '../lib/formato.ts';
  import { rutas } from '../lib/rutas.svelte.ts';
  import type { Hora } from '../lib/tipos.ts';
  import FormHoras from '../componentes/FormHoras.svelte';
  import FormPagarPlanilla from '../componentes/FormPagarPlanilla.svelte';
  import Ventana from '../componentes/Ventana.svelte';

  const c = $derived(datos.c!);
  let abierta = $state<'' | 'horas' | 'pagar'>('');
  let pagarA = $state('');

  // Trabajadores del catálogo + los que tengan horas aunque ya no estén en el catálogo.
  const nombres = $derived([...new Set([...c.trabajadores.map((t) => t.nombre), ...c.horas.map((h) => h.trabajador)])]);
  const filas = $derived(
    c.horas
      .filter((h) => (!filtro.trabajador || h.trabajador === filtro.trabajador) && (!filtro.pagado || (filtro.pagado === 'si') === h.pagado))
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.registrado.localeCompare(a.registrado)),
  );

  function pagar(nombre: string) {
    pagarA = nombre;
    abierta = 'pagar';
  }

  async function borrar(h: Hora) {
    const ok = await dialogos.confirmar('¿Borrar este registro de horas?', `${fecha(h.fecha)} · ${h.trabajador} · ${h.horas} horas`, { si: 'Borrar', peligro: true });
    if (!ok) return;
    try {
      await borrarHora(h);
      dialogos.avisar('Borrado');
    } catch (e) {
      dialogos.fallo(e);
    }
  }
</script>

<h1>Planilla</h1>
<div class="acciones">
  <button class="btn-dorado" onclick={() => (abierta = 'horas')}>+ Registrar horas</button>
  <button class="btn" onclick={() => pagar('')}>Pagar planilla</button>
  <span class="ayuda">Sin pagar en total: <strong>{colones(planillaSinPagar(c.horas))}</strong></span>
</div>

<section class="tarjeta seccion">
  <div class="tarjeta-titulo">
    <h2>Trabajadores</h2>
    <button class="btn-borde btn-chico" onclick={() => rutas.ir('catalogos')}>Editar en Catálogos → Trabajadores</button>
  </div>
  <div class="tabla-envoltura">
    <table class="tabla apilable">
      <thead>
        <tr><th>Nombre</th><th>Puesto</th><th class="num">Valor por hora</th><th>Teléfono</th><th class="num">Horas sin pagar</th><th class="num">Monto sin pagar</th><th class="num">Total pagado</th><th><span class="oculto-visual">Acciones</span></th></tr>
      </thead>
      <tbody>
        {#each nombres as nombre (nombre)}
          {@const t = c.trabajadores.find((x) => x.nombre === nombre)}
          {@const r = resumenTrabajador(nombre, c.horas)}
          <tr>
            <td data-etiqueta="Nombre"><strong>{nombre}</strong></td>
            <td data-etiqueta="Puesto">{t?.puesto ?? ''}</td>
            <td data-etiqueta="Valor por hora" class="num">{t?.valorHora != null ? colones(t.valorHora) : '—'}</td>
            <td data-etiqueta="Teléfono">{t?.telefono ?? ''}</td>
            <td data-etiqueta="Horas sin pagar" class="num">{r.horasSinPagar}</td>
            <td data-etiqueta="Monto sin pagar" class="num"><strong>{colones(r.montoSinPagar)}</strong></td>
            <td data-etiqueta="Total pagado" class="num">{colones(r.totalPagado)}</td>
            <td class="sin-etiqueta">{#if r.montoSinPagar > 0}<button class="btn btn-chico" onclick={() => pagar(nombre)}>Pagar</button>{/if}</td>
          </tr>
        {:else}
          <tr><td colspan="8" class="vacio sin-etiqueta">Todavía no hay trabajadores. Se agregan al registrar horas o en Catálogos.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<section class="tarjeta seccion">
  <div class="tarjeta-titulo">
    <h2>Registro de horas</h2>
    <div class="filtros">
      <select bind:value={filtro.trabajador} aria-label="Filtrar por trabajador"><option value="">Todos</option>{#each nombres as n}<option>{n}</option>{/each}</select>
      <select bind:value={filtro.pagado} aria-label="Filtrar por pagado"><option value="">Pagadas y sin pagar</option><option value="no">Sin pagar</option><option value="si">Pagadas</option></select>
    </div>
  </div>
  <div class="tabla-envoltura">
    <table class="tabla apilable">
      <thead>
        <tr><th>Fecha</th><th>Trabajador</th><th>Obra</th><th class="num">Horas</th><th class="num">Valor por hora</th><th class="num">Total</th><th>¿Pagado?</th><th>Notas</th><th>Registró</th><th><span class="oculto-visual">Acciones</span></th></tr>
      </thead>
      <tbody>
        {#each filas as h (h.id)}
          <tr>
            <td data-etiqueta="Fecha">{fecha(h.fecha)}</td>
            <td data-etiqueta="Trabajador">{h.trabajador}</td>
            <td data-etiqueta="Obra">{h.cotizacion}</td>
            <td data-etiqueta="Horas" class="num">{h.horas}</td>
            <td data-etiqueta="Valor por hora" class="num">{colones(h.valorHora)}</td>
            <td data-etiqueta="Total" class="num"><strong>{colones(totalHora(h))}</strong></td>
            <td data-etiqueta="¿Pagado?">{#if h.pagado}<span class="pagado">Sí · {fecha(h.fechaPago)}</span>{:else}<span class="debe">No pagado</span>{/if}</td>
            <td data-etiqueta="Notas">{h.notas}</td>
            <td data-etiqueta="Registró">{h.registradoPor}</td>
            <td class="sin-etiqueta">{#if !h.pagado}<button class="btn-peligro btn-chico" onclick={() => borrar(h)}>Borrar</button>{/if}</td>
          </tr>
        {:else}
          <tr><td colspan="10" class="vacio sin-etiqueta">No hay horas registradas{filtro.trabajador || filtro.pagado ? ' con ese filtro' : ''}.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<Ventana abierta={abierta === 'horas'} titulo="Registrar horas" cerrar={() => (abierta = '')}>
  <FormHoras listo={() => (abierta = '')} />
</Ventana>
<Ventana abierta={abierta === 'pagar'} titulo="Pagar planilla" cerrar={() => (abierta = '')}>
  {#key pagarA}<FormPagarPlanilla inicial={pagarA} listo={() => (abierta = '')} />{/key}
</Ventana>

<style>
  .seccion {
    margin-top: 16px !important;
  }
  .filtros {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .filtros select {
    width: auto;
    margin: 0;
  }
  .pagado {
    color: #22603a;
    font-weight: 600;
  }
  .debe {
    color: #8a6400;
    font-weight: 700;
  }
</style>
