<script lang="ts">
  /**
   * Una cotización guardada: su vista para el cliente, el estado, notas internas y todas
   * sus versiones. Dirección: #/ver/COT-0003, #/ver/COT-0003/v1 o #/ver/COT-0003/versiones.
   */
  import { tick } from 'svelte';
  import { guardarNotasInternas, modificar, nombreDe, pdfDe, usarDeBase, vistaDe } from '../lib/abrir.ts';
  import { datos } from '../lib/datos.svelte.ts';
  import { dialogos } from '../lib/dialogos.svelte.ts';
  import { compartir, descargar } from '../lib/exportar.svelte.ts';
  import { colones, fecha, fechaHora } from '../lib/formato.ts';
  import { rutas } from '../lib/rutas.svelte.ts';
  import SelectorEstado from '../componentes/SelectorEstado.svelte';
  import VistaEscalada from '../componentes/VistaEscalada.svelte';

  const partes = $derived(rutas.actual.split('/').slice(1).map(decodeURIComponent));
  const numero = $derived(partes[0] ?? '');
  const c = $derived(datos.c?.cotizaciones.find((x) => x.numero === numero));
  const pedida = $derived(/^v(\d+)$/.exec(partes[1] ?? '')?.[1]);
  const v = $derived(c ? (c.versiones.find((x) => String(x.version) === pedida) ?? c.versiones[c.versiones.length - 1]) : undefined);
  const esUltima = $derived(!!c && !!v && v.version === c.versionActual);
  const vista = $derived(v ? vistaDe(v) : null);

  let notas = $state('');
  let notasDe = '';
  $effect(() => {
    // Al cambiar de cotización (o si la otra persona cambió las notas), mostrar las guardadas.
    const actuales = c?.notasInternas ?? '';
    if (c && (notasDe !== c.numero || !notasCambiadas)) {
      notas = actuales;
      notasDe = c.numero;
    }
  });
  const notasCambiadas = $derived((notas ?? '').trim() !== (c?.notasInternas ?? '').trim());
  let guardandoNotas = $state(false);

  let ocupado = $state('');
  let seccionVersiones = $state<HTMLElement>();

  $effect(() => {
    if (partes[1] === 'versiones' && seccionVersiones) tick().then(() => seccionVersiones?.scrollIntoView({ behavior: 'smooth' }));
  });

  async function guardarNotas() {
    if (!c) return;
    guardandoNotas = true;
    try {
      await guardarNotasInternas(c.numero, notas);
    } finally {
      guardandoNotas = false;
    }
  }

  async function archivo(modo: 'descargar' | 'compartir') {
    if (!c || !v) return;
    ocupado = 'pdf' + modo;
    try {
      const blob = await pdfDe(v);
      const nombre = `${nombreDe(c, v)}.pdf`;
      if (modo === 'descargar') descargar(blob, nombre);
      else await compartir(blob, nombre);
    } catch (e) {
      dialogos.avisar('No se pudo crear el archivo: ' + (e instanceof Error ? e.message : String(e)), 'error');
    } finally {
      ocupado = '';
    }
  }

  function verVersion(n: number) {
    rutas.ir(`ver/${numero}/v${n}`);
  }
</script>

{#if !c || !v || !vista}
  <h1>Cotización</h1>
  <div class="tarjeta vacio">
    <p>No se encontró la cotización {numero}.</p>
    <button class="btn" onclick={() => rutas.ir('historial')}>Ir al Historial</button>
  </div>
{:else}
  <button class="volver btn-borde btn-chico" onclick={() => rutas.ir('historial')}>← Historial</button>

  <div class="titulo">
    <div>
      <h1>{c.numero} · {c.cliente}</h1>
      <p class="ayuda">
        Viendo la <strong>v{v.version}</strong>
        {esUltima ? '(la última)' : `(no es la última: la última es v${c.versionActual})`} · guardada {fechaHora(v.guardado) || fecha(v.guardado)} por {v.guardadoPor}
      </p>
    </div>
    <div class="estado">
      <SelectorEstado {c} />
      {#if c.estadoPor}<small class="ayuda">por {c.estadoPor}, {fecha(c.estadoFecha)}</small>{/if}
    </div>
  </div>

  {#if !esUltima}
    <div class="aviso-version">
      Esta es una versión anterior.
      <button class="btn-borde btn-chico" onclick={() => verVersion(c.versionActual)}>Ver la última (v{c.versionActual})</button>
    </div>
  {/if}

  <div class="distribucion">
    <div class="principal">
      <VistaEscalada v={vista} />
    </div>

    <aside class="lado">
      <section class="tarjeta">
        <h2>Acciones</h2>
        <div class="botones">
          <button class="btn" onclick={() => modificar(c, v)}>Modificar {esUltima ? '' : `la v${v.version}`}</button>
          <button class="btn-borde" onclick={() => usarDeBase(c, v)} title="Cotización nueva (número y fecha nuevos) con estos mismos datos">Usar de base para una nueva</button>
        </div>
        <h3 class="sub">Enviar al cliente</h3>
        <div class="enviar">
          <button class="btn-dorado" onclick={() => archivo('compartir')} disabled={!!ocupado}>{ocupado === 'pdfcompartir' ? 'Preparando…' : 'WhatsApp: PDF'}</button>
          <button class="btn-borde" onclick={() => archivo('descargar')} disabled={!!ocupado}>{ocupado === 'pdfdescargar' ? 'Preparando…' : 'Descargar PDF'}</button>
        </div>
      </section>

      <section class="tarjeta">
        <h2>Notas internas</h2>
        <p class="ayuda">Solo las ven Pablo y Lin; no salen en la cotización.</p>
        <textarea bind:value={notas} rows="3" aria-label="Notas internas" placeholder="Ej.: llamar el lunes para confirmar"></textarea>
        {#if notasCambiadas}
          <div class="acciones pie">
            <button class="btn btn-chico" onclick={guardarNotas} disabled={guardandoNotas}>{guardandoNotas ? 'Guardando…' : 'Guardar notas'}</button>
            <button class="btn-borde btn-chico" onclick={() => (notas = c.notasInternas ?? '')}>Deshacer</button>
          </div>
        {/if}
      </section>
    </aside>
  </div>

  <section class="tarjeta versiones" bind:this={seccionVersiones}>
    <h2>Versiones</h2>
    <div class="tabla-envoltura">
      <table class="tabla apilable">
        <thead>
          <tr>
            <th>Versión</th>
            <th>Guardada</th>
            <th>Guardada por</th>
            <th>Cliente</th>
            <th class="num">Total</th>
            <th>Qué cambió</th>
            <th>Estado</th>
            <th><span class="oculto-visual">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          {#each [...c.versiones].reverse() as x (x.version)}
            <tr class:actual-fila={x.version === v.version}>
              <td data-etiqueta="Versión"><strong>v{x.version}</strong></td>
              <td data-etiqueta="Guardada">{fechaHora(x.guardado) || fecha(x.guardado)}</td>
              <td data-etiqueta="Guardada por">{x.guardadoPor}</td>
              <td data-etiqueta="Cliente">{x.datos.cliente}</td>
              <td data-etiqueta="Total" class="num">{colones(x.total)}</td>
              <td data-etiqueta="Qué cambió">{x.queCambio}</td>
              <td data-etiqueta="Estado">
                <span class="etiqueta" class:es-actual={x.version === c.versionActual}>{x.version === c.versionActual ? 'Actual' : 'Anterior'}</span>
              </td>
              <td class="sin-etiqueta">
                <div class="acciones">
                  {#if x.version === v.version}
                    <span class="ayuda">Viéndola</span>
                  {:else}
                    <button class="btn-borde btn-chico" onclick={() => verVersion(x.version)}>Ver</button>
                  {/if}
                  <button class="btn-borde btn-chico" onclick={() => modificar(c, x)}>Cargar en el editor</button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
{/if}

<style>
  .volver {
    margin-bottom: 10px;
  }
  .titulo {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .titulo h1 {
    margin: 0 0 4px;
  }
  .estado {
    display: grid;
    justify-items: end;
    gap: 2px;
  }
  .aviso-version {
    background: #fff1c9;
    border: 1px solid #ecd58f;
    border-radius: 8px;
    padding: 10px 12px;
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }
  .distribucion {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 290px;
    gap: 18px;
    align-items: start;
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
  .botones {
    display: grid;
    gap: 8px;
  }
  .sub {
    font-size: 0.95rem;
    margin: 16px 0 8px;
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
  .pie {
    margin-top: 8px;
  }
  .versiones {
    margin-top: 18px !important;
  }
  .actual-fila td {
    background: #fbf6ec;
  }
  .etiqueta {
    border-radius: 999px;
    padding: 2px 10px;
    font-size: 0.8rem;
    font-weight: 700;
    background: #ece7dd;
    color: var(--suave);
  }
  .etiqueta.es-actual {
    background: var(--verde);
    color: #fff;
  }
  @media (max-width: 1100px) {
    .distribucion {
      grid-template-columns: minmax(0, 1fr);
    }
    .lado {
      position: static;
      order: -1;
    }
  }
</style>
