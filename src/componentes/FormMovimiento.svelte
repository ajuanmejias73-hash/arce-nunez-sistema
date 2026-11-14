<script lang="ts">
  /** Registrar o editar un gasto (o un ingreso que no es pago de cotización). */
  import { guardarMovimiento } from '../lib/acciones-contables.ts';
  import { datos } from '../lib/datos.svelte.ts';
  import { dialogos } from '../lib/dialogos.svelte.ts';
  import { hoyISO } from '../lib/formato.ts';
  import type { Movimiento, TipoMovimiento } from '../lib/tipos.ts';
  import CampoNumero from './CampoNumero.svelte';

  let { tipo, editar = null, listo }: { tipo: TipoMovimiento; editar?: Movimiento | null; listo: () => void } = $props();

  const c = $derived(datos.c!);
  // svelte-ignore state_referenced_locally
  const inicial = editar;
  // svelte-ignore state_referenced_locally
  const tipoInicial = tipo;
  const categorias = $derived(tipoInicial === 'Gasto' ? c.ajustes.listas.categoriasGasto : c.ajustes.listas.categoriasIngreso);
  const obras = $derived([...c.cotizaciones].sort((a, b) => b.numero.localeCompare(a.numero, 'es', { numeric: true })));

  let f = $state({
    fecha: inicial?.fecha || hoyISO(),
    categoria: inicial?.categoria ?? '',
    descripcion: inicial?.descripcion ?? '',
    cotizacion: inicial?.cotizacion ?? '',
    persona: inicial?.persona ?? '',
    metodo: inicial?.metodo ?? datos.c!.ajustes.listas.metodosPago[0] ?? '',
    monto: (inicial?.monto ?? null) as number | null,
    comprobante: inicial?.comprobante ?? '',
    // La nota automática de los estimados se quita al poner el monto real.
    notas: inicial?.estimado && /^Estimado de /.test(inicial.notas) ? '' : (inicial?.notas ?? ''),
  });
  if (!f.categoria) f.categoria = (tipoInicial === 'Gasto' ? datos.c!.ajustes.listas.categoriasGasto : datos.c!.ajustes.listas.categoriasIngreso.filter((x) => x === 'Otro ingreso'))[0] ?? '';
  let guardando = $state(false);

  async function enviar(ev: SubmitEvent) {
    ev.preventDefault();
    if (!f.monto || f.monto <= 0) return dialogos.avisar('Escribí el monto.', 'error');
    if (!f.fecha) return dialogos.avisar('Falta la fecha.', 'error');
    if (!f.categoria) return dialogos.avisar('Escogé la categoría.', 'error');
    if (f.cotizacion && !c.cotizaciones.some((x) => x.numero === f.cotizacion)) return dialogos.avisar(`La obra ${f.cotizacion} no existe.`, 'error');
    guardando = true;
    try {
      await guardarMovimiento(inicial?.id ?? null, {
        tipo: tipoInicial,
        fecha: f.fecha,
        categoria: f.categoria,
        descripcion: f.descripcion.trim(),
        cotizacion: f.cotizacion,
        persona: f.persona.trim(),
        metodo: f.metodo,
        monto: Math.round(f.monto),
        comprobante: f.comprobante.trim(),
        notas: f.notas.trim(),
        ...(inicial?.pagoPlanilla ? { pagoPlanilla: inicial.pagoPlanilla } : {}),
      });
      dialogos.avisar('Guardado');
      listo();
    } catch (e) {
      dialogos.fallo(e);
    } finally {
      guardando = false;
    }
  }
</script>

<form onsubmit={enviar} class="form">
  {#if inicial?.estimado}
    <p class="aviso-estimado">Este gasto es un <strong>estimado</strong> que salió de la cotización. Poné el monto real: al guardar deja de ser estimado.</p>
  {/if}
  <div class="campos">
    <label>
      Categoría
      <select bind:value={f.categoria}>
        {#if f.categoria && !categorias.includes(f.categoria)}<option>{f.categoria}</option>{/if}
        {#each categorias as x}<option>{x}</option>{/each}
      </select>
    </label>
    <label>Monto (₡) <CampoNumero bind:valor={f.monto} dinero etiqueta="Monto" /></label>
    <label class="ancho">Descripción <input bind:value={f.descripcion} placeholder={tipoInicial === 'Gasto' ? 'ej. 10 sacos de cemento' : ''} /></label>
    <label>
      Obra (opcional)
      <select bind:value={f.cotizacion}>
        <option value="">— ninguna —</option>
        {#each obras as x}<option value={x.numero}>{x.numero} · {x.cliente}</option>{/each}
      </select>
    </label>
    <label>{tipoInicial === 'Gasto' ? 'Proveedor o trabajador' : 'De quién'} (opcional) <input bind:value={f.persona} /></label>
    <label>
      Método
      <select bind:value={f.metodo}>{#each c.ajustes.listas.metodosPago as m}<option>{m}</option>{/each}</select>
    </label>
    <label>Fecha <input type="date" bind:value={f.fecha} /></label>
    <label>Comprobante (opcional) <input bind:value={f.comprobante} placeholder="N.º de factura o recibo" /></label>
    <label>Notas (opcional) <input bind:value={f.notas} /></label>
  </div>
  <div class="acciones">
    <button class="btn" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : inicial ? 'Guardar cambios' : tipoInicial === 'Gasto' ? 'Registrar gasto' : 'Registrar ingreso'}</button>
    <button class="btn-borde" type="button" onclick={listo}>Cancelar</button>
  </div>
</form>

<style>
  .form {
    display: grid;
    gap: 14px;
  }
  .aviso-estimado {
    background: #fff1c9;
    border: 1px solid #ecd58f;
    border-radius: 8px;
    padding: 8px 10px;
    margin: 0;
  }
</style>
