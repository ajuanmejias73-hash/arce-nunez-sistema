<script lang="ts">
  /** "Pagar planilla" (sección 10.2): suma lo que se debe por obra y crea un gasto por cada obra. */
  import { pagarPlanilla } from '../lib/acciones-contables.ts';
  import { horasPorObra, resumenTrabajador } from '../lib/contabilidad.ts';
  import { datos } from '../lib/datos.svelte.ts';
  import { dialogos } from '../lib/dialogos.svelte.ts';
  import { colones, hoyISO } from '../lib/formato.ts';

  let { inicial = '', listo }: { inicial?: string; listo: () => void } = $props();

  const c = $derived(datos.c!);
  const conDeuda = $derived([...new Set(c.horas.filter((h) => !h.pagado).map((h) => h.trabajador))].sort((a, b) => a.localeCompare(b, 'es')));
  // svelte-ignore state_referenced_locally
  let trabajador = $state(inicial);
  let metodo = $state(datos.c!.ajustes.listas.metodosPago[0] ?? '');
  let fecha = $state(hoyISO());
  let guardando = $state(false);

  $effect(() => {
    if (!trabajador && conDeuda[0]) trabajador = conDeuda[0];
  });

  const grupos = $derived(trabajador ? horasPorObra(trabajador, c.horas) : []);
  const total = $derived(grupos.reduce((s, g) => s + g.monto, 0));
  const nombreObra = (n: string) => (n ? `${n} · ${c.cotizaciones.find((x) => x.numero === n)?.cliente ?? ''}` : 'Sin obra');

  async function enviar(ev: SubmitEvent) {
    ev.preventDefault();
    if (!grupos.length) return;
    guardando = true;
    try {
      const r = await pagarPlanilla(trabajador, metodo, fecha);
      dialogos.avisar(`Planilla de ${trabajador} pagada: ${colones(r.total)} (${r.gastos} ${r.gastos === 1 ? 'gasto' : 'gastos'} registrados)`);
      listo();
    } catch (e) {
      dialogos.fallo(e);
    } finally {
      guardando = false;
    }
  }
</script>

{#if !conDeuda.length}
  <p class="vacio">No hay horas sin pagar.</p>
  <button class="btn-borde" onclick={listo}>Cerrar</button>
{:else}
  <form onsubmit={enviar} class="form">
    <label>
      Trabajador
      <select bind:value={trabajador}>
        {#each conDeuda as t}<option value={t}>{t} · {colones(resumenTrabajador(t, c.horas).montoSinPagar)}</option>{/each}
      </select>
    </label>

    <table class="tabla">
      <thead><tr><th>Obra</th><th class="num">Horas</th><th class="num">Monto</th></tr></thead>
      <tbody>
        {#each grupos as g}
          <tr><td>{nombreObra(g.cotizacion)}</td><td class="num">{g.horas}</td><td class="num">{colones(g.monto)}</td></tr>
        {/each}
        <tr class="total"><td>Total a pagar</td><td></td><td class="num">{colones(total)}</td></tr>
      </tbody>
    </table>

    <div class="campos">
      <label>
        Método
        <select bind:value={metodo}>{#each c.ajustes.listas.metodosPago as m}<option>{m}</option>{/each}</select>
      </label>
      <label>Fecha de pago <input type="date" bind:value={fecha} /></label>
    </div>
    <p class="ayuda">Las horas quedan como pagadas y se registra un gasto "Planilla" por cada obra.</p>
    <div class="acciones">
      <button class="btn" type="submit" disabled={guardando || !grupos.length}>{guardando ? 'Guardando…' : `Pagar ${colones(total)}`}</button>
      <button class="btn-borde" type="button" onclick={listo}>Cancelar</button>
    </div>
  </form>
{/if}

<style>
  .form {
    display: grid;
    gap: 12px;
  }
  .total td {
    font-weight: 700;
    border-top: 2px solid var(--carbon);
  }
</style>
