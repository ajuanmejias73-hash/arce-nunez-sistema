<script lang="ts">
  /** Botones para registrar dinero (en Pagos y gastos y en Contabilidad). */
  import type { Movimiento, TipoMovimiento } from '../lib/tipos.ts';
  import FormMovimiento from './FormMovimiento.svelte';
  import FormPago from './FormPago.svelte';
  import Ventana from './Ventana.svelte';

  let { editar = $bindable(null) }: { editar?: Movimiento | null } = $props();
  let abierta = $state<'' | 'pago' | 'gasto' | 'ingreso'>('');

  const cerrar = () => {
    abierta = '';
    editar = null;
  };
  const tipoEditar = $derived<TipoMovimiento>(editar?.tipo ?? 'Gasto');
</script>

<div class="acciones">
  <button class="btn-dorado" onclick={() => (abierta = 'pago')}>+ Pago de cliente</button>
  <button class="btn" onclick={() => (abierta = 'gasto')}>+ Gasto</button>
  <button class="btn-borde" onclick={() => (abierta = 'ingreso')}>+ Otro ingreso</button>
</div>

<Ventana abierta={abierta === 'pago'} titulo="Registrar pago de cliente" {cerrar}>
  <FormPago listo={cerrar} />
</Ventana>
<Ventana abierta={abierta === 'gasto'} titulo="Registrar gasto" {cerrar}>
  <FormMovimiento tipo="Gasto" listo={cerrar} />
</Ventana>
<Ventana abierta={abierta === 'ingreso'} titulo="Registrar otro ingreso" {cerrar}>
  <FormMovimiento tipo="Ingreso" listo={cerrar} />
</Ventana>
<Ventana abierta={!!editar} titulo={editar?.tipo === 'Ingreso' ? 'Editar ingreso' : 'Editar gasto'} {cerrar}>
  {#key editar?.id}
    <FormMovimiento tipo={tipoEditar} {editar} listo={cerrar} />
  {/key}
</Ventana>
