<script lang="ts">
  /** "Registrar horas" (sección 10.2): queda como "No pagado". */
  import { registrarHoras } from '../lib/acciones-contables.ts';
  import { datos } from '../lib/datos.svelte.ts';
  import { dialogos } from '../lib/dialogos.svelte.ts';
  import { aNumero, colones, hoyISO } from '../lib/formato.ts';
  import CampoNumero from './CampoNumero.svelte';

  let { listo }: { listo: () => void } = $props();

  const c = $derived(datos.c!);
  const NUEVO = '__nuevo__';
  let trabajador = $state(datos.c!.trabajadores[0]?.nombre ?? NUEVO);
  let nombre = $state('');
  let puesto = $state('');
  let telefono = $state('');
  let horas = $state('');
  let valorHora = $state<number | null>(datos.c!.trabajadores[0]?.valorHora ?? null);
  let obra = $state('');
  let fecha = $state(hoyISO());
  let notas = $state('');
  let guardando = $state(false);

  const obras = $derived([...c.cotizaciones].sort((a, b) => b.numero.localeCompare(a.numero, 'es', { numeric: true })));
  const total = $derived((aNumero(horas) ?? 0) * (valorHora ?? 0));

  function escoger() {
    valorHora = c.trabajadores.find((t) => t.nombre === trabajador)?.valorHora ?? null;
  }

  async function enviar(ev: SubmitEvent) {
    ev.preventDefault();
    const nuevo = trabajador === NUEVO;
    const quien = nuevo ? nombre.trim() : trabajador;
    const h = aNumero(horas);
    if (!quien) return dialogos.avisar('Escribí el nombre del trabajador.', 'error');
    if (nuevo && c.trabajadores.some((t) => t.nombre.toLowerCase() === quien.toLowerCase())) return dialogos.avisar(`Ya existe «${quien}»: escogelo de la lista.`, 'error');
    if (h === null || h <= 0) return dialogos.avisar('Escribí las horas (pueden llevar decimales, ej. 4.5).', 'error');
    if (!valorHora || valorHora <= 0) return dialogos.avisar('Escribí el valor por hora.', 'error');
    if (!fecha) return dialogos.avisar('Falta la fecha.', 'error');
    guardando = true;
    try {
      await registrarHoras(
        { fecha, trabajador: quien, cotizacion: obra, horas: h, valorHora: Math.round(valorHora), notas: notas.trim() },
        nuevo ? { puesto: puesto.trim(), valorHora: Math.round(valorHora), telefono: telefono.trim() } : null,
      );
      dialogos.avisar(`Registradas ${h} horas de ${quien}`);
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
    Trabajador
    <select bind:value={trabajador} onchange={escoger}>
      {#each c.trabajadores as t}<option value={t.nombre}>{t.nombre}{t.puesto ? ` (${t.puesto})` : ''}</option>{/each}
      <option value={NUEVO}>＋ Trabajador nuevo</option>
    </select>
  </label>
  {#if trabajador === NUEVO}
    <div class="campos nuevo">
      <!-- svelte-ignore a11y_autofocus -->
      <label>Nombre <input bind:value={nombre} autofocus /></label>
      <label>Puesto <input bind:value={puesto} placeholder="ej. Ayudante" /></label>
      <label>Teléfono (opcional) <input bind:value={telefono} inputmode="tel" /></label>
    </div>
  {/if}
  <div class="campos">
    <label>Horas <input bind:value={horas} inputmode="decimal" placeholder="ej. 8 o 4.5" /></label>
    <label>Valor por hora (₡) <CampoNumero bind:valor={valorHora} dinero etiqueta="Valor por hora" /></label>
    <label>
      Obra (opcional)
      <select bind:value={obra}>
        <option value="">— ninguna —</option>
        {#each obras as x}<option value={x.numero}>{x.numero} · {x.cliente}</option>{/each}
      </select>
    </label>
    <label>Fecha <input type="date" bind:value={fecha} /></label>
    <label class="ancho">Notas (opcional) <input bind:value={notas} /></label>
  </div>
  {#if total > 0}<p class="total">Total: <strong>{colones(total)}</strong> · queda como "No pagado"</p>{/if}
  <div class="acciones">
    <button class="btn" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Registrar horas'}</button>
    <button class="btn-borde" type="button" onclick={listo}>Cancelar</button>
  </div>
</form>

<style>
  .form {
    display: grid;
    gap: 12px;
  }
  .nuevo {
    background: var(--fondo);
    border-radius: 8px;
    padding: 10px;
  }
  .total {
    margin: 0;
  }
</style>
