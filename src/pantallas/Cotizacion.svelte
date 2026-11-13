<script lang="ts">
  import { tick } from 'svelte';
  import { datos } from '../lib/datos.svelte.ts';
  import { dialogos } from '../lib/dialogos.svelte.ts';
  import { editor } from '../lib/editor.svelte.ts';
  import { compartir, descargar, exportador } from '../lib/exportar.svelte.ts';
  import { colones, porcentaje } from '../lib/formato.ts';
  import { nombreArchivo } from '../lib/modelo.ts';
  import { rutas } from '../lib/rutas.svelte.ts';
  import { sesion } from '../lib/sesion.svelte.ts';
  import CampoNumero from '../componentes/CampoNumero.svelte';
  import Interruptor from '../componentes/Interruptor.svelte';
  import EditorPartes from '../componentes/EditorPartes.svelte';
  import EditorMateriales from '../componentes/EditorMateriales.svelte';
  import EditorFotos from '../componentes/EditorFotos.svelte';
  import VistaEscalada from '../componentes/VistaEscalada.svelte';

  const MAX_NOTAS = 6;

  let pestana = $state<'escribir' | 'vista'>('escribir');
  let ocupado = $state<'' | 'guardar' | 'pdf' | 'compartir-pdf'>('');
  let campoCliente = $state<HTMLInputElement>();

  const resultado = $derived(editor.d && datos.c ? editor.vista() : null);
  const tiposTrabajo = $derived(datos.c?.ajustes.listas.tiposTrabajo ?? []);
  const tasaIva = $derived(datos.c?.ajustes.porDefecto.iva ?? 0.13);

  async function faltaCliente(): Promise<boolean> {
    if (editor.d?.cliente.trim()) return false;
    dialogos.avisar('Falta el nombre del cliente.', 'error');
    pestana = 'escribir';
    await tick();
    campoCliente?.focus();
    return true;
  }

  async function guardar() {
    if (!editor.d || (await faltaCliente())) return;
    let queCambio = '';
    if (editor.base && editor.guardada) {
      const t = await dialogos.pedirTexto(
        `Guardar como v${editor.guardada.versionActual + 1}`,
        '¿Qué cambió? (opcional)',
        { si: 'Guardar', texto: `La versión anterior (v${editor.guardada.versionActual}) queda guardada.` },
      );
      if (t === null) return;
      queCambio = t;
    }
    ocupado = 'guardar';
    try {
      const r = await editor.guardar(queCambio, sesion.quien);
      dialogos.avisar(`Guardada: ${r.numero} v${r.version.version}`);
      // El PDF de esta versión queda guardado para descargarlo desde el Historial.
      try {
        const blob = await exportador.pdf(r.version.vista as never);
        await datos.subirArchivo(r.version.pdf!, new Uint8Array(await blob.arrayBuffer()), `PDF de ${r.numero} v${r.version.version}`, sesion.quien);
      } catch (e) {
        dialogos.avisar('La cotización se guardó, pero su PDF no: ' + (e instanceof Error ? e.message : String(e)), 'error');
      }
    } catch (e) {
      dialogos.fallo(e);
    } finally {
      ocupado = '';
    }
  }

  async function exportar(modo: 'descargar' | 'compartir') {
    if (!resultado || !editor.d || (await faltaCliente())) return;
    ocupado = modo === 'descargar' ? 'pdf' : 'compartir-pdf';
    try {
      const blob = await exportador.pdf(resultado.vista);
      const nombre = `${nombreArchivo(editor.d.numero, editor.d.cliente.trim())}.pdf`;
      if (modo === 'descargar') descargar(blob, nombre);
      else await compartir(blob, nombre);
    } catch (e) {
      dialogos.avisar('No se pudo crear el archivo: ' + (e instanceof Error ? e.message : String(e)), 'error');
    } finally {
      ocupado = '';
    }
  }
</script>

{#if !editor.d || !resultado}
  <h1>Cotización</h1>
  <div class="tarjeta vacio">
    <p>No hay ninguna cotización abierta.</p>
    <div class="acciones centro">
      <button class="btn-dorado" onclick={() => rutas.ir('nueva')}>+ Nueva cotización</button>
      <button class="btn" onclick={() => rutas.ir('modificar')}>Modificar cotización</button>
    </div>
  </div>
{:else}
  {@const d = editor.d}
  {@const c = resultado.calculo}
  <div class="titulo">
    <div>
      <h1>{d.numero}{d.cliente.trim() ? ' · ' + d.cliente.trim() : ''}</h1>
      <p class="version">
        {editor.etiquetaVersion}
        {#if editor.sinGuardar}<span class="sin-guardar">Sin guardar</span>{/if}
        {#if editor.guardada}
          · <button class="enlace" onclick={() => rutas.ir('ver/' + editor.guardada!.numero)}>Ver en el Historial</button>
        {/if}
      </p>
    </div>
    <div class="pestanas" role="tablist">
      <button role="tab" aria-selected={pestana === 'escribir'} class:activa={pestana === 'escribir'} onclick={() => (pestana = 'escribir')}>Escribir</button>
      <button role="tab" aria-selected={pestana === 'vista'} class:activa={pestana === 'vista'} onclick={() => (pestana = 'vista')}>Ver cotización</button>
    </div>
  </div>

  <div class="distribucion">
    <div class="principal">
      {#if pestana === 'vista'}
        <VistaEscalada v={resultado.vista} />
      {:else}
        <!-- 1. CLIENTE -->
        <section class="tarjeta">
          <h2>1. Datos del cliente</h2>
          <div class="campos">
            <label>N.º de cotización <input value={d.numero} readonly class="solo-lectura" /></label>
            <label>Fecha <input type="date" bind:value={d.fecha} /></label>
            <label>Cliente * <input bind:value={d.cliente} bind:this={campoCliente} autocomplete="off" /></label>
            <label>Teléfono del cliente <input bind:value={d.telefono} inputmode="tel" autocomplete="off" /></label>
            <label>Ubicación <input bind:value={d.ubicacion} placeholder="ej. Grecia, Alajuela" /></label>
            <label>
              Tipo de trabajo
              <input bind:value={d.tipoTrabajo} list="lista-tipos" placeholder="Escogé o escribí" />
              <datalist id="lista-tipos">{#each tiposTrabajo as t}<option value={t}></option>{/each}</datalist>
            </label>
            <label class="ancho">Trabajo solicitado <input bind:value={d.trabajoSolicitado} placeholder="Frase corta" /></label>
            <label class="ancho">Detalle extra (opcional) <input bind:value={d.detalleExtra} /></label>
          </div>
        </section>

        <!-- 2. PRECIO -->
        <section class="tarjeta">
          <h2>2. Precio y condiciones</h2>
          <div class="modo" role="radiogroup" aria-label="Modo de precio">
            {#each ['Total a mano', 'Partes + materiales'] as const as m}
              <label class:activo={d.modoPrecio === m}>
                <input type="radio" bind:group={d.modoPrecio} value={m} />
                <strong>{m}</strong>
                <span>{m === 'Total a mano' ? 'Escribís el total vos' : 'Suma los montos de las Partes (y materiales si los compra Arce Nuñez)'}</span>
              </label>
            {/each}
          </div>
          <div class="campos">
            {#if d.modoPrecio === 'Total a mano'}
              <label>Total a mano (₡) <CampoNumero bind:valor={d.totalAMano} dinero etiqueta="Total a mano" /></label>
            {/if}
            <label>% de adelanto <CampoNumero bind:valor={d.porcentajeAdelanto} factor={100} etiqueta="Porcentaje de adelanto" /></label>
            <label>
              ¿Quién compra los materiales?
              <select bind:value={d.quienCompraMateriales}>
                <option>El cliente</option>
                <option>Arce Nuñez</option>
              </select>
            </label>
            <label>Validez (días) <input type="number" min="0" bind:value={d.validezDias} /></label>
            <label>Garantía (meses) <input type="number" min="0" bind:value={d.garantiaMeses} /></label>
            <label>Horario de trabajo <input bind:value={d.horario} /></label>
            <Interruptor bind:valor={d.cobrarIVA} etiqueta="¿Cobrar IVA {porcentaje(tasaIva)}?" />
            <Interruptor bind:valor={d.mostrarMateriales} etiqueta="¿Mostrar lista de materiales?" />
            <label class="ancho">
              Forma de pago especial (opcional)
              <textarea bind:value={d.formaPagoEspecial} rows="2" placeholder="Si se llena, reemplaza la forma de pago normal y oculta adelanto y saldo. Ej.: Pago semanal de ₡250,000 los viernes…"></textarea>
            </label>
          </div>

          <h3 class="sub">Lo que ve el cliente</h3>
          <div class="campos">
            <Interruptor bind:valor={d.clienteVe.montoPartes} etiqueta="Monto de cada Parte" ayuda={d.modoPrecio === 'Total a mano' ? 'Solo en modo Partes + materiales' : ''} />
            <Interruptor bind:valor={d.clienteVe.preciosMateriales} etiqueta="Precios de los materiales" ayuda="Solo en modo Partes y si compra Arce Nuñez" />
            <Interruptor bind:valor={d.clienteVe.desglose} etiqueta="Desglose del total" />
            <Interruptor bind:valor={d.clienteVe.adelantoSaldo} etiqueta="Adelanto y saldo" />
          </div>
        </section>

        <!-- 3. PARTES -->
        <section class="tarjeta">
          <h2>3. Partes del trabajo</h2>
          <EditorPartes {d} />
        </section>

        <!-- 4. MATERIALES -->
        <section class="tarjeta">
          <h2>4. Materiales</h2>
          <EditorMateriales {d} calculo={c} />
        </section>

        <!-- 5. NOTAS -->
        <section class="tarjeta">
          <h2>5. Notas</h2>
          {#each d.notas as _, i}
            <div class="nota">
              <textarea bind:value={d.notas[i]} rows="2" aria-label="Nota {i + 1}"></textarea>
              <button class="btn-peligro btn-chico" onclick={() => d.notas.splice(i, 1)}>Quitar</button>
            </div>
          {/each}
          {#if d.notas.length < MAX_NOTAS}
            <button class="btn-dorado" onclick={() => d.notas.push('')}>+ Nota</button>
          {/if}
        </section>

        <!-- 6. FOTOS -->
        <section class="tarjeta">
          <h2>6. Fotos de referencia</h2>
          <EditorFotos {d} />
        </section>
      {/if}
    </div>

    <aside class="lado">
      <section class="tarjeta resumen">
        <h2>Resumen</h2>
        {#if d.modoPrecio === 'Partes + materiales'}
          <div class="linea"><span>Mano de obra</span><span>{colones(c.manoDeObra)}</span></div>
          <div class="linea">
            <span>Materiales {d.quienCompraMateriales === 'El cliente' ? '(los compra el cliente)' : ''}</span>
            <span class:tachado={d.quienCompraMateriales === 'El cliente'}>{colones(c.materiales)}</span>
          </div>
        {/if}
        {#if d.cobrarIVA}
          <div class="linea"><span>Subtotal</span><span>{colones(c.subtotal)}</span></div>
          <div class="linea"><span>IVA {porcentaje(tasaIva)}</span><span>{colones(c.iva)}</span></div>
        {/if}
        <div class="linea total"><span>TOTAL</span><span>{colones(c.total)}</span></div>
        <div class="linea"><span>Adelanto ({porcentaje(d.porcentajeAdelanto)})</span><span>{colones(c.adelanto)}</span></div>
        <div class="linea"><span>Saldo</span><span>{colones(c.saldo)}</span></div>
      </section>

      <section class="tarjeta">
        <button class="btn ancho-completo" onclick={guardar} disabled={!!ocupado}>
          {ocupado === 'guardar' ? 'Guardando…' : 'Guardar en historial'}
        </button>
        <h3 class="sub">Enviar al cliente</h3>
        <div class="enviar">
          <button class="btn-dorado" onclick={() => exportar('compartir')} disabled={!!ocupado}>
            {ocupado === 'compartir-pdf' ? 'Preparando…' : 'Enviar por WhatsApp'}
          </button>
          <button class="btn-borde" onclick={() => exportar('descargar')} disabled={!!ocupado}>
            {ocupado === 'pdf' ? 'Preparando…' : 'Descargar PDF'}
          </button>
        </div>
        <p class="ayuda">En el celular, "Enviar por WhatsApp" abre el menú para compartir: escogé WhatsApp y el contacto. Si un aparato no puede compartir, el PDF se descarga.</p>
      </section>
    </aside>
  </div>

  <!-- Barra fija abajo en el celular -->
  <div class="barra-celular">
    <span class="total-mini">{colones(c.total)}</span>
    <button class="btn-borde" onclick={() => (pestana = pestana === 'vista' ? 'escribir' : 'vista')}>{pestana === 'vista' ? 'Escribir' : 'Ver'}</button>
    <button class="btn" onclick={guardar} disabled={!!ocupado}>{ocupado === 'guardar' ? 'Guardando…' : 'Guardar'}</button>
  </div>
{/if}

<style>
  .titulo {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }
  .titulo h1 {
    margin: 0;
  }
  .version {
    margin: 4px 0 0;
    color: var(--suave);
    font-size: 0.9rem;
  }
  .enlace {
    background: none;
    border: none;
    padding: 0;
    min-height: 0;
    color: var(--dorado-osc);
    text-decoration: underline;
    font-weight: 600;
    font-size: inherit;
  }
  .sin-guardar {
    background: #fff1c9;
    color: #6b4d00;
    border-radius: 999px;
    padding: 2px 10px;
    font-weight: 700;
    font-size: 0.78rem;
    margin-left: 6px;
  }
  .pestanas {
    display: flex;
    background: var(--blanco);
    border: 1px solid var(--linea);
    border-radius: 999px;
    padding: 3px;
  }
  .pestanas button {
    border-radius: 999px;
    background: transparent;
    border: none;
    padding: 6px 16px;
    min-height: 36px;
  }
  .pestanas button.activa {
    background: var(--carbon);
    color: var(--dorado-claro);
  }
  .distribucion {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 290px;
    gap: 18px;
    align-items: start;
  }
  .principal .tarjeta + .tarjeta {
    margin-top: 16px;
  }
  .lado {
    position: sticky;
    top: 76px;
    display: grid;
    gap: 16px;
  }
  .lado .tarjeta + .tarjeta {
    margin-top: 0;
  }
  .solo-lectura {
    background: var(--fondo);
    font-weight: 700;
  }
  .sub {
    font-size: 0.95rem;
    margin: 18px 0 8px;
  }
  .modo {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 14px;
  }
  .modo label {
    border: 2px solid var(--linea);
    border-radius: 10px;
    padding: 10px 12px;
    cursor: pointer;
    display: grid;
    gap: 2px;
    color: var(--texto);
    font-weight: 400;
  }
  .modo label.activo {
    border-color: var(--dorado);
    background: #fbf6ec;
  }
  .modo label:focus-within {
    outline: 2px solid var(--dorado);
  }
  .modo label {
    position: relative;
  }
  .modo input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
    min-height: 0;
    margin: 0;
  }
  .modo span {
    font-size: 0.82rem;
    color: var(--suave);
  }
  .nota {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin-bottom: 8px;
  }
  .nota textarea {
    margin: 0;
  }
  .resumen h2 {
    margin-bottom: 8px;
  }
  .linea {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 0;
    font-size: 0.92rem;
  }
  .linea.total {
    border-top: 2px solid var(--carbon);
    border-bottom: 2px solid var(--carbon);
    margin: 6px 0;
    padding: 8px 0;
    font-weight: 700;
    font-size: 1.1rem;
  }
  .tachado {
    text-decoration: line-through;
    color: var(--suave);
  }
  .ancho-completo {
    width: 100%;
  }
  .enviar {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .enviar button {
    padding: 8px 6px;
    font-size: 0.88rem;
  }
  .centro {
    justify-content: center;
  }
  .barra-celular {
    display: none;
  }

  @media (max-width: 1100px) {
    .distribucion {
      grid-template-columns: minmax(0, 1fr);
    }
    .lado {
      position: static;
    }
  }
  @media (max-width: 860px) {
    .barra-celular {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 15;
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 8px 16px calc(8px + env(safe-area-inset-bottom));
      background: var(--blanco);
      border-top: 1px solid var(--linea);
      box-shadow: 0 -4px 16px rgb(0 0 0 / 8%);
    }
    .total-mini {
      flex: 1;
      font-weight: 700;
      font-size: 1.1rem;
    }
    .distribucion {
      padding-bottom: 70px;
    }
    .modo {
      grid-template-columns: 1fr;
    }
  }
</style>
