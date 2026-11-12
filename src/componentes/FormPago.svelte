<script lang="ts">
  /** "Registrar pago de cliente" (sección 10.2). */
  import { registrarPago } from '../lib/acciones-contables.ts';
  import { infoPago } from '../lib/contabilidad.ts';
  import { datos } from '../lib/datos.svelte.ts';
  import { dialogos } from '../lib/dialogos.svelte.ts';
  import { colones, hoyISO } from '../lib/formato.ts';
  import CampoNumero from './CampoNumero.svelte';

  let { listo }: { listo: () => void } = $props();

  const c = $derived(datos.c!);
  const lista = $derived([...c.cotizaciones].filter((x) => x.estado !== 'Rechazada').sort((a, b) => b.numero.localeCompare(a.numero, 'es', { numeric: true })));
  let numero = $state('');
  let monto = $state<number | null>(null);
  let metodo = $state(datos.c!.ajustes.listas.metodosPago[0] ?? '');
  let fecha = $state(hoyISO());
  let comprobante = $state('');
  let notas = $state('');
  let guardando = $state(false);

  const cot = $derived(c.cotizaciones.find((x) => x.numero === numero));
  const info = $derived(cot ? infoPago(cot, c.movimientos) : null);

  function escoger() {
    monto = info ? info.sugerido || null : null;
  }

  async function enviar(ev: SubmitEvent) {
    ev.preventDefault();
    if (!cot) return dialogos.avisar('Escogé la cotización.', 'error');
    if (!monto || monto <= 0) return dialogos.avisar('Escribí el monto.', 'error');
    if (!fecha) return dialogos.avisar('Falta la fecha.', 'error');
    guardando = true;
    try {
      const resumen = await registrarPago(cot.numero, Math.round(monto), metodo, fecha, comprobante.trim(), notas.trim());
      dialogos.avisar(resumen);
      listo();
    } catch (e) {
      dialogos.fallo(e);
    } finally {
      guardando = false;
    }
  }
</script>

<form onsubmit={enviar} class="form">
  <label>
    Cotización (obra)
    <select bind:value={numero} onchange={escoger}>
      <option value="" disabled>Escogé…</option>
      {#each lista as x}
        {@const i = infoPago(x, c.movimientos)}
        <option value={x.numero}>{x.numero} · {x.cliente} · {i.pendiente > 0 ? `le falta ${colones(i.pendiente)}` : 'pagada'}</option>
      {/each}
    </select>
  </label>

  {#if info}
    <div class="info">
      <span>Total <strong>{colones(info.total)}</strong></span>
      <span>Ya pagó <strong>{colones(info.pagado)}</strong></span>
      <span>Le falta <strong>{colones(info.pendiente)}</strong></span>
    </div>
    <p class="ayuda">{info.pagado === 0 ? `Se sugiere el adelanto (${colones(info.adelanto)}).` : 'Se sugiere lo que le falta.'}</p>
  {/if}

  <div class="campos">
    <label>Monto (₡) <CampoNumero bind:valor={monto} dinero etiqueta="Monto del pago" /></label>
    <label>
      Método
      <select bind:value={metodo}>{#each c.ajustes.listas.metodosPago as m}<option>{m}</option>{/each}</select>
    </label>
    <label>Fecha <input type="date" bind:value={fecha} /></label>
    <label>Comprobante (opcional) <input bind:value={comprobante} placeholder="N.º de SINPE o recibo" /></label>
    <label class="ancho">Notas (opcional) <input bind:value={notas} /></label>
  </div>
  <p class="ayuda">La categoría (Adelanto, Abono o Saldo final) y el estado de la cotización se ponen solos.</p>
  <div class="acciones">
    <button class="btn" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Registrar pago'}</button>
    <button class="btn-borde" type="button" onclick={listo}>Cancelar</button>
  </div>
</form>

<style>
  .form {
    display: grid;
    gap: 12px;
  }
  .info {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    background: var(--fondo);
    border-radius: 8px;
    padding: 10px 12px;
  }
  .ayuda {
    margin: 0;
  }
</style>
